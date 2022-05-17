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
    isView: number;
}


interface DbColumnsResponse {
    name: string;
    type: string;
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

    const tablesQuery = 'sys.tables';
    const viewsQuery = 'sys.views';

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
            SchemaName, name, isView`;

    let dbResult = await runQuery<DbObjectResponse>(Provider.MSSQL, connectionId, query);

    const result: DatabaseObject[] = [];
    for (let index = 0; index < dbResult.length; index++) {
        const element = dbResult[index];

        const dbTable: DatabaseObject = {
            Name: element.name,
            Schema: element.SchemaName,
            ObjectType: element.isView ? DatabaseObjectType.View : DatabaseObjectType.Table
        };

        result.push(dbTable);
    }
    return result;
};


export const getMssqlDbColumns = async (
    connectionId: string,
    table: DatabaseObject
) => {

    if (table == undefined) {
        return [];
    }

    const query = `
        SELECT  
            syscolumns.name
            , CASE WHEN ut.xtype = ut.xusertype OR st.name IS NULL THEN ut.name ELSE ut.name + ':' + st.name END as type
        FROM
            syscolumns 
            INNER JOIN sysobjects ON syscolumns.id = sysobjects.id 
            INNER JOIN systypes ut ON syscolumns.xusertype = ut.xusertype 
            LEFT OUTER JOIN systypes st ON ut.xtype = st.xusertype
        WHERE
            (sysobjects.name = N'${table.Name}') 
            and (schema_Name(sysobjects.uid) = N'${table.Schema}')
        ORDER BY
            syscolumns.name`;

    let dbResult = await runQuery<DbColumnsResponse>(Provider.MSSQL, connectionId, query);

    const result: DatabaseColumn[] = [];
    for (let index = 0; index < dbResult.length; index++) {
        const element = dbResult[index];
        const dbColumn: DatabaseColumn = {
            Name: element.name,
            Type: element.type
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
) => {

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
) => {

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
    filter: string
) => {

    if (table == undefined) {
        return {
            rows: [],
            count: 0
        };
    }
    
    const snapshotSize = 20;
    const whereExpression = filter ? 'WHERE ' + filter : '';

    const queryRows = `
        SELECT TOP(${snapshotSize}) * 
        FROM [${table.Schema}].[${table.Name}]
        ${whereExpression}`;

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