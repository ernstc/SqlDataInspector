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
    schema_name: string;
    is_view: string;
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


export class DbRepositoryPGSQL implements IDbRepository{

    constructor(
        private connectionContext: ConnectionContext
    ) { }


    async getDatabaseInfo(): Promise<DatabaseInfo> {

        const query = 'SELECT version() as version';

        let dbResult = await DbRepository.runQuery<any>(this.connectionContext, query);

        let version = '';
        if (dbResult.length > 0) {
            const match = dbResult[0].version.match(/PostgreSQL (\d+\.\d+)/);
            version = match ? match[1] : '';
        }

        return {
            Provider: 'PGSQL',
            NameEncloserStart: '"',
            NameEncloserEnd: '"',
            Version: version
        };
    }


    async getDbObjects(
        tables: boolean = true,
        views: boolean = true
    ): Promise<DatabaseObject[]> {

        const databaseName = this.connectionContext.fqname.databaseName;

        const tablesAndViewsQuery = `
            SELECT 
                table_name AS name,
                table_schema AS schema_name,
                CASE
                    WHEN table_type = 'BASE TABLE' THEN 0
                    WHEN table_type = 'VIEW' THEN 1
                    ELSE 0
                END AS is_view
            FROM 
                information_schema.tables 
            WHERE 
                table_catalog = '${databaseName}'
                AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY 
                is_view, schema_name, name`;

        const tablesQuery = `
            SELECT 
                table_name AS name,
                table_schema AS schema_name,
                0 AS is_view
            FROM 
                information_schema.tables 
            WHERE 
                table_type = 'BASE TABLE' AND table_catalog = '${databaseName}'
                AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY 
                is_view, schema_name, name`;

        const viewsQuery = `
            SELECT 
                table_name AS name,
                table_schema AS schema_name,
                1 AS is_view
            FROM 
                information_schema.tables 
            WHERE 
                table_type = 'VIEW' AND table_catalog = '${databaseName}'
                AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY 
                is_view, schema_name, name`;

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
                Schema: element.schema_name,
                ObjectType: element.is_view === '1' ? DatabaseObjectType.View : DatabaseObjectType.Table
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
                cols.column_name AS name, 
                cols.udt_name AS type,
                cols.is_nullable AS is_nullable,
                CASE 
                    WHEN pk.column_name IS NOT NULL THEN 1 
                    ELSE 0
                END AS is_primary_key,
                cols.ordinal_position AS key_ordinal,
                CASE 
                    WHEN fk.column_name IS NOT NULL THEN 1 
                    ELSE 0
                END AS has_foreign_key,
                cols.ordinal_position AS column_id
            FROM 
                information_schema.columns cols
            LEFT JOIN 
                information_schema.key_column_usage AS pk 
            ON 
                cols.table_name = pk.table_name 
                AND cols.column_name = pk.column_name 
                AND pk.constraint_name = 'PRIMARY'
            LEFT JOIN 
                information_schema.key_column_usage AS fk 
            ON 
                cols.table_name = fk.table_name 
                AND cols.column_name = fk.column_name 
                AND fk.constraint_name != 'PRIMARY'
            WHERE 
                cols.table_schema = '${table.Schema}' AND cols.table_name = '${table.Name}'            
            ORDER BY
                ${sortingExpression}
        `;
    
        let dbResult = await DbRepository.runQuery<DbColumnsResponse>(this.connectionContext, query);
    
        const result: DatabaseColumn[] = [];
        for (let index = 0; index < dbResult.length; index++) {
            const element = dbResult[index];

            let type = element.type;
            if (element.is_nullable === 'YES') {
                type += ' ?';
            }

            const dbColumn: DatabaseColumn = {
                Name: element.name,
                Type: element.type,
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
    
        if (column.Type.startsWith('_')
            || /binary|text|image|bytea|variant|xml|json|jsonb|any|array/.test(column.Type)
        ) {
            // Create a query for counting NULL and NOT NULL values.
            const andWhereExpression = filter ? 'AND ' + filter : '';
            
            query = `
                SELECT '[NULL]' as value, COUNT(*) as count 
                FROM "${table.Schema}"."${table.Name}"
                WHERE "${column.Name}" IS NULL ${andWhereExpression}
                UNION
                SELECT '[NOT NULL]' as value, COUNT(*) as count 
                FROM "${table.Schema}"."${table.Name}"
                WHERE "${column.Name}" IS NOT NULL ${andWhereExpression}`;
        }
        else {
            // Create a query for counting distinct values.
            let sortColumn: string;
            if (sortAscendingColumnValues !== undefined && sortAscendingColumnValues !== null) {
                sortColumn = `"${column.Name}"`;
                if (sortAscendingColumnValues === false) { sortColumn += ' DESC'; }
            }
            else if (sortAscendingColumnValuesCount !== undefined && sortAscendingColumnValuesCount !== null) {
                sortColumn = `COUNT(*)`;
                if (sortAscendingColumnValuesCount === false) { sortColumn += ' DESC'; }
            }
            else {
                sortColumn = `"${column.Name}"`;
            }
    
            const whereExpression = filter ? 'WHERE ' + filter : '';
    
            query = `
                SELECT "${column.Name}" as value, COUNT(*) as count 
                FROM "${table.Schema}"."${table.Name}"
                ${whereExpression}
                GROUP BY "${column.Name}"
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
            orderByColumns = orderByColumns?.map((col, index) => sortAscending[index] ? `"${col}"` : `"${col}"` + ' DESC');
        }
    
        const whereExpression = filter ? 'WHERE ' + filter : '';
        const orderBy = hasOrderingColumns ? `ORDER BY ${orderByColumns?.join(',')}` : '';
    
        let columnsExpression = '';
        if (columns !== undefined && columns !== null && columns.length > 0) {
            columnsExpression = columns.map(col => {
                let statement = `"${col.Name}"`;
                return statement;
            }).join(',');
        }
        else {
            columnsExpression = '*';
        }
    
        const queryRows = `
            SELECT ${columnsExpression}
            FROM "${table.Schema}"."${table.Name}"
            ${whereExpression}
            ${orderBy}
            OFFSET ${(pageIndex - 1) * pageSize} LIMIT ${pageSize}`;
    
        const queryCount = `
            SELECT COUNT(*) as count
            FROM "${table.Schema}"."${table.Name}"
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
            FROM "${table.Schema}"."${table.Name}"
            ${whereExpression}`;
    
        let dbCountResult = await DbRepository.runQuery<DbCountResponse>(this.connectionContext, queryCount);
    
        return {
            count: dbCountResult.length > 0 ? dbCountResult[0].count : 0
        };
    }
}