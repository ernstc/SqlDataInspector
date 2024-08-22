import { SimpleExecuteResult } from "azdata";
import { DatabaseColumn } from '../models/database-column.model';
import { DatabaseColumnValue } from '../models/database-columnValue.model';
import { DatabaseInfo } from "../models/database-info.model";
import { DatabaseObject } from "../models/database-object.model";
import { ConnectionContext } from "../connection-context";
import { DbRepositoryMSSQL } from "./db.repository.mssql";
import { DbRepositoryMySQL } from "./db.repository.mysql";
import { DbRepositoryPGSQL } from "./db.repository.pgsql";


export type DbProviderType = "MSSQL" | "MySQL" | "PGSQL";

export interface QueryResults<T> {
    sessionId?: string;
    data: T;
}


export interface IDbRepository {

    getDatabaseInfo(): Promise<DatabaseInfo>;

    getDbObjects(
        sessionId: string,
        tables?: boolean,
        views?: boolean
    ): Promise<QueryResults<DatabaseObject[]>>;
    
    getDbColumns(
        sessionId: string,
        table: DatabaseObject,
        sortColumnNames?: string
    ): Promise<QueryResults<DatabaseColumn[]>>;

    getDbColumnValuesWithCount(
        sessionId: string,
        table: DatabaseObject,
        column: DatabaseColumn,
        filter: string,
        sortAscendingColumnValues?: boolean,
        sortAscendingColumnValuesCount?: boolean
    ): Promise<QueryResults<DatabaseColumnValue[]>>;

    getDbTableRows(
        sessionId: string,
        table: DatabaseObject,
        columns: DatabaseColumn[] | undefined,
        filter: string,
        orderByColumns?: string[],
        sortAscending?: boolean[],
        pageIndex?: number,
        pageSize?: number
    ): Promise<QueryResults<{ rows: any[], count: number }>>;

    getDbTableRowsCount(
        sessionId: string,
        table: DatabaseObject,
        filter: string
    ): Promise<QueryResults<{ count: number }>>;
}



const mapResult = <T>(result: SimpleExecuteResult): T[] => result.rows.map(element => {
    const item: any = {};
    for (let columnIndex = 0; columnIndex < result.columnInfo.length; columnIndex++) {
        item[result.columnInfo[columnIndex].columnName] = undefinedOrValue(element[columnIndex].displayValue);
    }
    return item as T;
});

const undefinedOrValue = (value: string) => value !== 'NULL' ? value : undefined;

// This regular expression works by looking for a semicolon (;) followed by any number of characters 
// that are not a quote ([^"']), then a quote ((['"])), then any number of characters that are not 
// a quote ([^"']), then the same quote that was matched before (\1), repeated any number of times ((?:...)*), 
// followed by any number of characters that are not a quote ([^"']*), until the end of the string ($). 
// This ensures that the semicolon is not within quotes.
const sqlInjectionTestRegex = /;(?=(?:[^"'`]*(['"`])[^"'`]*\1)*[^"'`]*$)/;


export class DbRepository {

    public static create(connectionContext: ConnectionContext) {
        const provider = connectionContext.connection.providerName as DbProviderType;
        switch (provider) {
            case "MSSQL":
                connectionContext.repository = new DbRepositoryMSSQL(connectionContext);
                break;
            case "MySQL":
                connectionContext.repository = new DbRepositoryMySQL(connectionContext);
                break;
            case "PGSQL":
                connectionContext.repository = new DbRepositoryPGSQL(connectionContext);
                break;
            default:
                throw new Error(`Provider "${provider}" not supported`);
        }
    }


    private static lockRunQuery: boolean = false;

    public static async runQuery<T>(connectionContext: ConnectionContext, query: string): Promise<T[]> {
        const delayTime = 100;
        const maxDelay = 200 * delayTime;

        var context = connectionContext;

        var totalDelay = 0;
        while (this.lockRunQuery) {
            await new Promise(resolve => setTimeout(resolve, delayTime));
            
            totalDelay += delayTime;
            if (totalDelay >= maxDelay) {
                break;
            }
        }
        
        this.lockRunQuery = true;
        
        try {
            const result = await context.runQueryAndReturn(query);
            await new Promise(resolve => setTimeout(resolve, 500));
            return mapResult(result) as T[];
        }
        catch (e: any) {
            console.error(e.message);
            return [] as T[];
        }
        finally {
            this.lockRunQuery = false;
        }
    }

    public static hasPotentialSqlInjection(value: string): boolean {
        if (value && sqlInjectionTestRegex.test(value)) {
            return true;
        }
        return false;
    }
}
