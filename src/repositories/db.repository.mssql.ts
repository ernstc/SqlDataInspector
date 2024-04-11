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


const getBaseType = (type: string): string => {
    let baseType = type.split(' ')[0];
    if (baseType.indexOf(':') > 0) {
        baseType = baseType.substring(baseType.indexOf(':') + 1);
    }
    return baseType;
}


export class DbRepositoryMSSQL implements IDbRepository{

    constructor(
        private connectionContext: ConnectionContext
    ) { }

    
    async getDatabaseInfo(): Promise<DatabaseInfo> {
        const query = `SELECT @@VERSION AS version`;
        let dbResult = await DbRepository.runQuery<{ version: string }>(this.connectionContext, query);
        let version = dbResult.length > 0 ? dbResult[0].version : '';
        let versionMatch = version.match(/\b\d+(\.\d+){0,3}\b/);
        let parsedVersion = versionMatch ? versionMatch[0] : '';
        return {
            Provider: 'MSSQL',
            NameEncloserStart: '[',
            NameEncloserEnd: ']',
            Version: parsedVersion
        };
    }


    async getDbObjects(
        tables: boolean = true,
        views: boolean = true
    ): Promise<DatabaseObject[]> {

        const tablesAndViewsQuery = `
        (
            SELECT object_id, schema_id, name, is_ms_shipped, 0 AS isView
            FROM sys.tables
            UNION
            SELECT object_id, schema_id, name, is_ms_shipped, 1 AS isView
            FROM sys.views
        )`;

        const tablesQuery = `
            (
                SELECT object_id, schema_id, name, is_ms_shipped, 0 AS isView
                FROM sys.tables
            )`;

        const viewsQuery = `
            (
                SELECT object_id, schema_id, name, is_ms_shipped, 1 AS isView
                FROM sys.views
            )`;

        const objectsQuery: string | null =
            tables && views ? tablesAndViewsQuery :
            tables ? tablesQuery :
            views ? viewsQuery :
            null;

        if (objectsQuery === null) {
            return [];
        }

        const query = `
            SELECT 
                name,
                schema_Name(schema_id) AS SchemaName,
                isView
            FROM
                (
                SELECT
                    *,
                    CAST(
                        CASE
                            WHEN tbl.is_ms_shipped = 1 THEN 1
                            WHEN (
                                SELECT
                                    major_id 
                                FROM
                                    sys.extended_properties 
                                WHERE
                                    major_id = tbl.object_id AND 
                                    minor_id = 0 AND
                                    class = 1 AND
                                    name = N'microsoft_database_tools_support') 
                                IS NOT NULL THEN 1
                            ELSE 0
                        END
                    AS bit) AS [IsSystemObject]
                FROM
                    ${objectsQuery} AS tbl
                ) v
            WHERE
                v.IsSystemObject = 0
            ORDER BY
                isView, SchemaName, name`;

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
            sortingExpression = 'c.name';
        }
        else if (sortColumnNames === 'descending') {
            sortingExpression = 'c.name DESC';
        }
        else {
            sortingExpression = `
                ${vscodeSettings.columnsShowPrimaryKeyFirst ? 'is_primary_key desc,' : ''}
                ${vscodeSettings.columnsOrderAlphabetically ? 'c.name' : 'c.column_id'}
            `;
        }
    
        let query = `
            SELECT distinct
                c.name
                , CASE WHEN ut.system_type_id = ut.user_type_id OR st.name IS NULL THEN ut.name ELSE ut.name + ':' + st.name END  
                    + CASE WHEN c.is_nullable = 1 THEN ' ?' ELSE '' END
                    + CASE WHEN st.name IN ('varchar', 'char', 'varbinary', 'binary', 'text')
                           THEN ' (' + CASE WHEN c.max_length = -1 THEN 'max' ELSE CAST(c.max_length AS VARCHAR(5)) END + ')'
                         WHEN st.name IN ('nvarchar', 'nchar', 'ntext')
                           THEN ' (' + CASE WHEN c.max_length = -1 THEN 'max' ELSE CAST(c.max_length / 2 AS VARCHAR(5)) END + ')'
                         WHEN st.name IN ('datetime2', 'time2', 'datetimeoffset') 
                           THEN ' (' + CAST(c.scale AS VARCHAR(5)) + ')'
                        WHEN st.name IN ('decimal', 'numeric')
                           THEN ' (' + CAST(c.[precision] AS VARCHAR(5)) + ',' + CAST(c.scale AS VARCHAR(5)) + ')'
                        ELSE ''
                    END AS type
                , ISNULL(i.is_primary_key, 0) AS is_primary_key
                , ISNULL(i.key_ordinal, 0) as key_ordinal
                , CASE WHEN fk.parent_column_id IS NOT NULL THEN 1 ELSE 0 END AS has_foreign_key
                , c.column_id
            FROM
                sys.columns c
                INNER JOIN sys.objects o ON c.object_id = o.object_id 
                INNER JOIN sys.types ut ON c.user_type_id = ut.user_type_id 
                LEFT OUTER JOIN sys.types st ON ut.system_type_id = st.user_type_id
                LEFT OUTER JOIN
                    (
                        SELECT
                            ic.column_id,
                            i.object_id,
                            i.is_primary_key,
                            ic.key_ordinal
                        FROM 
                            sys.indexes i
                            INNER JOIN sys.index_columns ic
                                ON ic.index_id = i.index_id 
                                AND i.object_id = ic.object_id
                                AND i.is_primary_key = 1
                    ) i
                    ON c.column_id = i.column_id
                    AND c.object_id = i.object_id
                LEFT OUTER JOIN sys.foreign_key_columns fk
                    ON c.object_id = fk.parent_object_id
                    AND c.column_id = fk.parent_column_id
            WHERE
                (o.name = N'${table.Name}') 
                and (schema_Name(o.schema_id) = N'${table.Schema}')
            ORDER BY
                ${sortingExpression}
        `;
    
        let dbResult = await DbRepository.runQuery<DbColumnsResponse>(this.connectionContext, query);
    
        const result: DatabaseColumn[] = [];
        for (let index = 0; index < dbResult.length; index++) {
            const element = dbResult[index];
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
    
        if (/binary|text|image|geography|geometry|variant|xml|json/.test(column.Type)) {
            // Create a query for counting NULL and NOT NULL values.
            const andWhereExpression = filter ? 'AND ' + filter : '';
            
            query = `
                SELECT '[NULL]' as value, COUNT(*) as count 
                FROM [${table.Schema}].[${table.Name}]
                WHERE [${column.Name}] is NULL ${andWhereExpression}
                UNION
                SELECT '[NOT NULL]' as value, COUNT(*) as count 
                FROM [${table.Schema}].[${table.Name}]
                WHERE [${column.Name}] is NOT NULL ${andWhereExpression}`;
        }
        else {
            // Create a query for counting distinct values.
            let sortColumn: string;
            if (sortAscendingColumnValues !== undefined && sortAscendingColumnValues !== null) {
                sortColumn = `[${column.Name}]`;
                if (sortAscendingColumnValues === false) { sortColumn += ' DESC'; }
            }
            else if (sortAscendingColumnValuesCount !== undefined && sortAscendingColumnValuesCount !== null) {
                sortColumn = `COUNT(*)`;
                if (sortAscendingColumnValuesCount === false) { sortColumn += ' DESC'; }
            }
            else {
                sortColumn = `[${column.Name}]`;
            }
    
            const whereExpression = filter ? 'WHERE ' + filter : '';
    
            query = `
                SELECT [${column.Name}] as value, COUNT(*) as count 
                FROM [${table.Schema}].[${table.Name}]
                ${whereExpression}
                GROUP BY [${column.Name}]
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
            orderByColumns = orderByColumns?.map((col, index) => sortAscending[index] ? col : col + ' DESC');
        }
    
        const whereExpression = filter ? 'WHERE ' + filter : '';
        const orderBy = hasOrderingColumns ? `
            ORDER BY ${orderByColumns?.join(',')}
            OFFSET ${(pageIndex - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY
            ` : '';
    
        const top = !hasOrderingColumns ? `TOP(${pageSize})` : '';
    
        let columnsExpression = '';
        if (columns !== undefined && columns !== null && columns.length > 0) {
            columnsExpression = columns.map(col => {
                let statement = `[${col.Name}]`;
                let colType = getBaseType(col.Type);
                if (colType === 'geography' || colType === 'geometry') {
                    statement = `CONVERT(varchar(max), [${col.Name}].ToString()) as [${col.Name}]`;
                }
                return statement;
            }).join(',');
        }
        else {
            columnsExpression = '*';
        }
    
        const queryRows = `
            SELECT ${top} ${columnsExpression}
            FROM [${table.Schema}].[${table.Name}]
            ${whereExpression}
            ${orderBy}`;
    
        const queryCount = `
            SELECT COUNT(*) as count
            FROM [${table.Schema}].[${table.Name}]
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
            FROM [${table.Schema}].[${table.Name}]
            ${whereExpression}`;
    
        let dbCountResult = await DbRepository.runQuery<DbCountResponse>(this.connectionContext, queryCount);
    
        return {
            count: dbCountResult.length > 0 ? dbCountResult[0].count : 0
        };
    }
}