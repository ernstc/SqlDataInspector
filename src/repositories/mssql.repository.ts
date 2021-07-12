import { DatabaseColumnValue } from './../models/database-columnValue.model';
import { connection } from 'azdata';
import { Database } from "../models/database.model";
import { DatabaseTable } from "../models/database-table.model";
import { runQuery } from "./base.repository";
import { Provider } from "../models/provider.enum";
import { DatabaseColumn } from '../models/database-column.model';


interface DbTablesResponse {
    name: string;
    SchemaName: string;
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


export const getMssqlDbTables = async (
    connectionId: string,
) => {

    const query = `
        SELECT
            name, 
            schema_Name(schema_id) AS SchemaName 
        FROM
            sys.objects 
        WHERE
            type='U' 
        ORDER BY
            SchemaName, name`;

    let dbResult = await runQuery<DbTablesResponse>(Provider.MSSQL, connectionId, query);

    const result: DatabaseTable[] = [];
    for (let index = 0; index < dbResult.length; index++) {
        const element = dbResult[index];

        const dbTable: DatabaseTable = {
            Name: element.name,
            Schema: element.SchemaName
        };

        result.push(dbTable);
    }
    return result;
};


export const getMssqlDbColumns = async (
    connectionId: string,
    table: DatabaseTable
) => {

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
    table: DatabaseTable,
    column: DatabaseColumn,
    filter: string
) => {
    
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
    table: DatabaseTable,
    column: DatabaseColumn,
    filter: string,
    sortAscendingColumnValues?: boolean,
    sortAscendingColumnValuesCount?: boolean
) => {

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
    table: DatabaseTable,
    filter: string
) => {
    
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
