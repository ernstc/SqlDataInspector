import { DbRepository, IDbRepository } from './db.repository';
import { DatabaseColumn } from '../models/database-column.model';
import { DatabaseColumnValue } from '../models/database-columnValue.model';
import { DatabaseInfo } from '../models/database-info.model';
import { DatabaseObject } from '../models/database-object.model';
import { DatabaseObjectType } from '../models/database-objectType.model';
import { VscodeSettings } from '../vscodeSettings';
import { ConnectionContext } from '../connection-context';


interface DbObjectResponse {
    name: string;
    SchemaName: string;
    isView: string;
}


interface DbColumnsResponse {
    name: string;
    type: string;
    is_nullable: string;
    is_primary_key: string;
    key_ordinal: string;
    has_foreign_key: string
}


interface DbColumnValuesResponse {
    value: string;
    count: number;
}


interface DbCountResponse {
    count: number;
}


export class DbRepositoryMySQL implements IDbRepository{

    constructor(
        private connectionContext: ConnectionContext
    ) { }


    async getDatabaseInfo(): Promise<DatabaseInfo> {

        const query = 'SELECT VERSION() as mysqlVersion';

        let dbResult = await DbRepository.runQuery<any>(this.connectionContext, query);

        return {
            Provider: 'MySQL',
            NameEncloserStart: '`',
            NameEncloserEnd: '`',
            Version: dbResult.length > 0 ? dbResult[0].mysqlVersion : ''
        };
    }


    async getDbObjects(
        tables: boolean = true,
        views: boolean = true
    ): Promise<DatabaseObject[]> {

        const table_schema = this.connectionContext.fqname.databaseName;

        const tablesAndViewsQuery = `
            SELECT 
                TABLE_NAME AS name,
                TABLE_SCHEMA AS SchemaName,
                CASE
                    WHEN TABLE_TYPE = 'BASE TABLE' THEN 0
                    WHEN TABLE_TYPE = 'VIEW' THEN 1
                    ELSE 0
                END AS isView
            FROM 
                information_schema.TABLES WHERE table_schema = '${table_schema}'
            ORDER BY 
                isView, SchemaName, name`;

        const tablesQuery = `
            SELECT 
                TABLE_NAME AS name,
                TABLE_SCHEMA AS SchemaName,
                0 AS isView
            FROM 
                information_schema.TABLES 
            WHERE 
                TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = '${table_schema}'
            ORDER BY 
                isView, SchemaName, name`;

        const viewsQuery = `
            SELECT 
                TABLE_NAME AS name,
                TABLE_SCHEMA AS SchemaName,
                1 AS isView
            FROM 
                information_schema.TABLES 
            WHERE 
                TABLE_TYPE = 'VIEW' AND TABLE_SCHEMA = '${table_schema}'
            ORDER BY 
                isView, SchemaName, name`;

        const query: string | null =
            tables && views ? tablesAndViewsQuery :
            tables ? tablesQuery :
            views ? viewsQuery :
            null;

        if (query === null) {
            return [];
        }
       
        let dbResult = await DbRepository.runQuery<DbObjectResponse>(this.connectionContext, query);

        const result: DatabaseObject[] = [];
        for (let index = 0; index < dbResult.length; index++) {
            const element = dbResult[index];

            const dbTable: DatabaseObject = {
                Name: element.name,
                Schema: element.SchemaName,
                ObjectType: element.isView === '1' ? DatabaseObjectType.View : DatabaseObjectType.Table
            };

            result.push(dbTable);
        }
        return result;
    }


    async getDbColumns(
        table: DatabaseObject,
        sortColumnNames?: string
    ): Promise<DatabaseColumn[]> {

        if (table === undefined || table === null) {
            return [];
        }
    
        const vscodeSettings = VscodeSettings.getInstance();
    
        let sortingExpression = '';
        if (sortColumnNames === 'ascending') {
            sortingExpression = 'name';
        }
        else if (sortColumnNames === 'descending') {
            sortingExpression = 'name DESC';
        }
        else {
            sortingExpression = `
                ${vscodeSettings.columnsShowPrimaryKeyFirst ? 'is_primary_key desc,' : ''}
                ${vscodeSettings.columnsOrderAlphabetically ? 'name' : 'column_id'}
            `;
        }
    
        let query = `
            SELECT 
                column_name AS name, 
                column_type AS type,
                CASE 
                    WHEN is_nullable = 'YES' THEN 1 
                    ELSE 0
                END AS is_nullable,
                CASE 
                    WHEN column_key = 'PRI' THEN 1 
                    ELSE 0
                END AS is_primary_key,
                ordinal_position AS key_ordinal,
                CASE 
                    WHEN column_key = 'UNI' THEN 1 
                    WHEN column_key = 'MUL' THEN 1
                    ELSE 0
                END AS has_foreign_key,
                ordinal_position AS column_id
            FROM 
                information_schema.columns 
            WHERE 
                table_schema = '${table.Schema}' AND table_name = '${table.Name}'            
            ORDER BY
                ${sortingExpression}
        `;
    
        let dbResult = await DbRepository.runQuery<DbColumnsResponse>(this.connectionContext, query);
    
        const result: DatabaseColumn[] = [];
        for (let index = 0; index < dbResult.length; index++) {
            const element = dbResult[index];

            let type = element.type.substring(2, element.type.length - 1);
            let typeParts = type.split('(');
            if (element.is_nullable === '1') {
                typeParts[0] += ' ?';
            }
            type = typeParts.join(' (');

            const dbColumn: DatabaseColumn = {
                Name: element.name,
                Type: type,
                IsPrimaryKey: element.is_primary_key === '1',
                KeyOrdinal: parseInt(element.key_ordinal),
                HasForeignKey: element.has_foreign_key === '1'
            };
            result.push(dbColumn);
        }
        return result;
    }


    async getDbColumnValuesWithCount(
        table: DatabaseObject,
        column: DatabaseColumn,
        filter: string,
        sortAscendingColumnValues?: boolean,
        sortAscendingColumnValuesCount?: boolean
    ): Promise<DatabaseColumnValue[]> {

        if (table === undefined || table === null 
            || column === undefined || column === null
            || DbRepository.hasPotentialSqlInjection(filter)
        ) {
            return [];
        }
    
        let query: string;
    
        if (/binary|text|image|geography|geometry|variant|xml|json/.test(column.Type)) {
            // Create a query for counting NULL and NOT NULL values.
            const andWhereExpression = filter ? 'AND ' + filter : '';
            
            query = `
                SELECT '[NULL]' as value, COUNT(*) as count 
                FROM \`${table.Schema}\`.\`${table.Name}\`
                WHERE \`${column.Name}\` IS NULL ${andWhereExpression}
                UNION
                SELECT '[NOT NULL]' as value, COUNT(*) as count 
                FROM \`${table.Schema}\`.\`${table.Name}\`
                WHERE \`${column.Name}\` IS NOT NULL ${andWhereExpression}`;
        }
        else {
            // Create a query for counting distinct values.
            let sortColumn: string;
            if (sortAscendingColumnValues !== undefined && sortAscendingColumnValues !== null) {
                sortColumn = `\`${column.Name}\``;
                if (sortAscendingColumnValues === false) { sortColumn += ' DESC'; }
            }
            else if (sortAscendingColumnValuesCount !== undefined && sortAscendingColumnValuesCount !== null) {
                sortColumn = `COUNT(*)`;
                if (sortAscendingColumnValuesCount === false) { sortColumn += ' DESC'; }
            }
            else {
                sortColumn = `\`${column.Name}\``;
            }
    
            const whereExpression = filter ? 'WHERE ' + filter : '';
    
            query = `
                SELECT \`${column.Name}\` as value, COUNT(*) as count 
                FROM \`${table.Schema}\`.\`${table.Name}\`
                ${whereExpression}
                GROUP BY \`${column.Name}\`
                ORDER BY ${sortColumn}`;
        }
    
        let dbResult = await DbRepository.runQuery<DbColumnValuesResponse>(this.connectionContext, query);
    
        const result: DatabaseColumnValue[] = [];
        for (let index = 0; index < dbResult.length; index++) {
            const element = dbResult[index];
            const dbColumnValue: DatabaseColumnValue = {
                Value: element.value === undefined ? '[NULL]' : element.value,
                Count: element.count
            };
            result.push(dbColumnValue);
        }
        return result;
    }


    async getDbTableRows(
        table: DatabaseObject,
        columns: DatabaseColumn[] | undefined,
        filter: string,
        orderByColumns?: string[],
        sortAscending?: boolean[],
        pageIndex: number = 1,
        pageSize: number = 20
    ): Promise<{ rows: any[]; count: number; }> {

        if (table === undefined || table === null 
            || DbRepository.hasPotentialSqlInjection(filter)
        ) {
            return {
                rows: [],
                count: 0
            };
        }
    
        if (pageIndex < 1) { pageIndex = 1; }
        if (pageSize < 0) { pageSize = 20; }
    
        const hasOrderingColumns: boolean = orderByColumns !== undefined && orderByColumns.length > 0;
        if (hasOrderingColumns && sortAscending !== undefined) {
            orderByColumns = orderByColumns?.map((col, index) => sortAscending[index] ? `\`${col}\`` : `\`${col}\`` + ' DESC');
        }
    
        const whereExpression = filter ? 'WHERE ' + filter : '';
        const orderBy = hasOrderingColumns ? `ORDER BY ${orderByColumns?.join(',')}` : '';
    
        let columnsExpression = '';
        if (columns !== undefined && columns !== null && columns.length > 0) {
            columnsExpression = columns.map(col => {
                let statement = `\`${col.Name}\``;
                return statement;
            }).join(',');
        }
        else {
            columnsExpression = '*';
        }
    
        const queryRows = `
            SELECT ${columnsExpression}
            FROM \`${table.Schema}\`.\`${table.Name}\`
            ${whereExpression}
            ${orderBy}
            LIMIT ${(pageIndex - 1) * pageSize}, ${pageSize}`;
    
        const queryCount = `
            SELECT COUNT(*) as count
            FROM \`${table.Schema}\`.\`${table.Name}\`
            ${whereExpression}`;
    
        let dbRowsResult = await DbRepository.runQuery<any>(this.connectionContext, queryRows);
        let dbCountResult = await DbRepository.runQuery<DbCountResponse>(this.connectionContext, queryCount);
    
        return {
            rows: dbRowsResult,
            count: dbCountResult.length > 0 ? dbCountResult[0].count : 0
        };
    }


    async getDbTableRowsCount(
        table: DatabaseObject,
        filter: string
    ): Promise<{ count: number; }> {

        if (table === undefined || table === null
            || DbRepository.hasPotentialSqlInjection(filter)
        ) {
            return {
                count: 0
            };
        }
    
        const whereExpression = filter ? 'WHERE ' + filter : '';
    
        const queryCount = `
            SELECT COUNT(*) as count
            FROM \`${table.Schema}\`.\`${table.Name}\`
            ${whereExpression}`;
    
        let dbCountResult = await DbRepository.runQuery<DbCountResponse>(this.connectionContext, queryCount);
    
        return {
            count: dbCountResult.length > 0 ? dbCountResult[0].count : 0
        };
    }
}