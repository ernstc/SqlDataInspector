import { DatabaseColumnValue } from '../models/database-columnValue.model';
import { connection } from 'azdata';
import { Database } from "../models/database.model";
import { DatabaseObject } from "../models/database-object.model";
import { DatabaseObjectType } from "../models/database-objectType.model";
import { runQuery } from "./base.repository";
import { Provider } from "../models/provider.enum";
import { DatabaseColumn } from '../models/database-column.model';


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


export const getMssqlDbObjects = async (
    connectionId: string,
    tables: boolean = true,
    views: boolean = true
): Promise<DatabaseObject[]> => {

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

    if (objectsQuery == null) {
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

    let dbResult = await runQuery<DbObjectResponse>(Provider.MSSQL, connectionId, query);

    const result: DatabaseObject[] = [];
    for (let index = 0; index < dbResult.length; index++) {
        const element = dbResult[index];

        const dbTable: DatabaseObject = {
            Name: element.name,
            Schema: element.SchemaName,
            ObjectType: element.isView == '1' ? DatabaseObjectType.View : DatabaseObjectType.Table
        };

        result.push(dbTable);
    }
    return result;
};


export const getMssqlDbColumns = async (
    connectionId: string,
    table: DatabaseObject
): Promise<DatabaseColumn[]> => {

    if (table == undefined) {
        return [];
    }

    const query = `
        SELECT distinct
            c.name
            , CASE WHEN ut.system_type_id = ut.user_type_id OR st.name IS NULL THEN ut.name ELSE ut.name + ':' + st.name END as type
            , ISNULL(i.is_primary_key, 0) AS is_primary_key
            , ISNULL(i.key_ordinal, 0) as key_ordinal
            , CASE WHEN fk.parent_column_id IS NOT NULL THEN 1 ELSE 0 END AS has_foreign_key
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
            c.name`;

    let dbResult = await runQuery<DbColumnsResponse>(Provider.MSSQL, connectionId, query);

    const result: DatabaseColumn[] = [];
    for (let index = 0; index < dbResult.length; index++) {
        const element = dbResult[index];
        const dbColumn: DatabaseColumn = {
            Name: element.name,
            Type: element.type,
            IsPrimaryKey: element.is_primary_key == '1',
            KeyOrdinal: parseInt(element.key_ordinal),
            HasForeignKey: element.has_foreign_key == '1'
        };
        result.push(dbColumn);
    }
    return result;
};


export const getMssqlDbColumnValues = async (
    connectionId: string,
    table: DatabaseObject,
    column: DatabaseColumn,
    filter: string
): Promise<string[]> => {

    if (table == undefined || column == undefined) {
        return [];
    }
    
    if (/binary|text|image|geography|geometry|variant|xml|json/.test(column.Type)) {
        return [];
    }

    const whereExpression = filter ? 'WHERE ' + filter : '';

    const query = `
        SELECT DISTINCT [${column.Name}] 
        FROM [${table.Schema}].[${table.Name}]
        ${whereExpression}
        ORDER BY [${column.Name}]`;

    let dbResult = await runQuery<string>(Provider.MSSQL, connectionId, query);

    const result: string[] = [];
    for (let index = 0; index < dbResult.length; index++) {
        const element = dbResult[index];
        result.push(element[<any>column.Name]);
    }

    return result;
};


export const getMssqlDbColumnValuesWithCount = async (
    connectionId: string,
    table: DatabaseObject,
    column: DatabaseColumn,
    filter: string,
    sortAscendingColumnValues?: boolean,
    sortAscendingColumnValuesCount?: boolean
): Promise<DatabaseColumnValue[]> => {

    if (table == undefined || column == undefined) {
        return [];
    }

    // Very simple SQL Injection prevention.
    if (filter != undefined && filter.indexOf(';') >= 0) {
        return [];
    }
    
    if (/binary|text|image|geography|geometry|variant|xml|json/.test(column.Type)) {
        return [];
    }

    const whereExpression = filter ? 'WHERE ' + filter : '';
    let sortColumn: string;

    if (sortAscendingColumnValues != undefined) {
        sortColumn = `[${column.Name}]`;
        if (sortAscendingColumnValues == false) sortColumn += ' DESC';
    }
    else if (sortAscendingColumnValuesCount != undefined) {
        sortColumn = `COUNT(*)`;
        if (sortAscendingColumnValuesCount == false) sortColumn += ' DESC';
    }
    else {
        sortColumn = `[${column.Name}]`;
    }

    const query = `
        SELECT [${column.Name}] as value, COUNT(*) as count 
        FROM [${table.Schema}].[${table.Name}]
        ${whereExpression}
        GROUP BY [${column.Name}]
        ORDER BY ${sortColumn}`;

    let dbResult = await runQuery<DbColumnValuesResponse>(Provider.MSSQL, connectionId, query);

    const result: DatabaseColumnValue[] = [];
    for (let index = 0; index < dbResult.length; index++) {
        const element = dbResult[index];
        const dbColumnValue: DatabaseColumnValue = {
            Value: element.value,
            Count: element.count
        };
        result.push(dbColumnValue);
    }

    return result;
};


export const getMssqlDbTableRows = async (
    connectionId: string,
    table: DatabaseObject,
    filter: string,
    orderByColumns?: string[],
    sortAscending?: boolean[],
    pageIndex: number = 1,
    pageSize: number = 20
) => {

    if (table == undefined) {
        return {
            rows: [],
            count: 0
        };
    }

    if (pageIndex < 1) pageIndex = 1;
    if (pageSize < 0) pageSize = 20;

    const hasOrderingColumns = orderByColumns != undefined && orderByColumns.length > 0;
    if (hasOrderingColumns && sortAscending != undefined) {
        orderByColumns = orderByColumns?.map((col, index) => sortAscending[index] ? col : col + ' DESC');
    }
    
    const whereExpression = filter ? 'WHERE ' + filter : '';
    const orderBy = hasOrderingColumns ? `
        ORDER BY ${orderByColumns?.join(',')}
        OFFSET ${(pageIndex - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY
        ` : '';

    const top = !hasOrderingColumns ? `TOP(${pageSize})` : '';

    const queryRows = `
        SELECT ${top} * 
        FROM [${table.Schema}].[${table.Name}]
        ${whereExpression}
        ${orderBy}`;

    const queryCount = `
        SELECT COUNT(*) as count
        FROM [${table.Schema}].[${table.Name}]
        ${whereExpression}`;

    let dbRowsResult = await runQuery<any>(Provider.MSSQL, connectionId, queryRows);
    let dbCountResult = await runQuery<DbCountResponse>(Provider.MSSQL, connectionId, queryCount);

    return {
        rows: dbRowsResult,
        count: dbCountResult.length > 0 ? dbCountResult[0].count : 0
    };
};


export const getMssqlDbTableRowsCount = async (
    connectionId: string,
    table: DatabaseObject,
    filter: string
) => {
    
    if (table == undefined) {
        return {
            count: 0
        };
    }

    const whereExpression = filter ? 'WHERE ' + filter : '';

    const queryCount = `
        SELECT COUNT(*) as count
        FROM [${table.Schema}].[${table.Name}]
        ${whereExpression}`;

    let dbCountResult = await runQuery<DbCountResponse>(Provider.MSSQL, connectionId, queryCount);

    return {
        count: dbCountResult.length > 0 ? dbCountResult[0].count : 0
    };
};