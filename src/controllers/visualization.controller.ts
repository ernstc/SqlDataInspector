import { DatabaseTable } from './../models/database-table.model';
import { dashboard, DashboardWebview, connection } from "azdata";
import { loadWebView } from "../web.loader";
import { visualizationPanelName } from "../constants";
import { Status } from "../models/status.enum";
import { getMssqlDbTables, getMssqlDbColumns, getMssqlDbColumnValues, getMssqlDbTableRows } from "../repositories/mssql.repository";
import { DatabaseColumn } from "../models/database-column.model";
import * as vscode from 'vscode';


interface IIncomingMessage {
    command: string;
    item: any;
}


interface IOutgoingMessage {
    status?: string;
    errors?: any[];
    databaseName?: string;
    tables?: any[];
    columns?: any[];
    values?: any[];
    rows?: any[];
    rowsHeader?: any[];
    table?: DatabaseTable;
    column?: DatabaseColumn;
}


export const VisualizationController = () => {
    let counterHtml = loadWebView();

    dashboard.registerWebviewProvider(
        visualizationPanelName,
        async (webview: DashboardWebview) => {
            webview.html = counterHtml;
            if (webview.connection.options.database) {

                webview.postMessage({
                    status: Status.GettingTableData,
                });

                const connections = await connection.getActiveConnections();
                const databaseName = webview.connection.options.database;
                const connectionId =
                    connections.find(c => c.options.database == databaseName)?.connectionId ??
                    webview.connection.connectionId;

                const dbTables = await getMssqlDbTables(connectionId);

                webview.postMessage({
                    status: Status.RenderingData,
                    //errors: undefined,
                    databaseName: databaseName,
                    tables: dbTables
                });

                let selectedTable: DatabaseTable;
                let selectedColumn: DatabaseColumn;
                let filter: string;

                webview.onMessage(async (data: IIncomingMessage) => {
                    switch (data.command) {
                        case 'selectedTable': {
                            selectedTable = data.item;
                            break;
                        }
                        case 'selectedColumn': {
                            selectedColumn = data.item;
                            break;
                        }
                        case 'loadColumns': {
                            await loadColumns(webview, connectionId, selectedTable); 
                            break;
                        }
                        case 'loadValues': {
                            await loadValues(webview, connectionId, selectedTable, selectedColumn, filter); 
                            break;
                        }
                        case 'loadRows': {
                            await loadRows(webview, connectionId, selectedTable, filter); 
                            break;
                        }
                        case 'changedFilter': {
                            filter = data.item;
                            break;
                        }
                        case 'copyText': {
                            vscode.env.clipboard.writeText(data.item);
                        }
                    }
                });
            } 
            else {
                webview.postMessage({
                    status: Status.NoDatabase,
                });
            }
        }
    );
}


const loadColumns = async(webview: DashboardWebview, connectionId: string, table: DatabaseTable) => {
    const dbColumns = await getMssqlDbColumns(connectionId, table);
    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        //errors: null,
        columns: dbColumns,
        table: table
    });
}


const loadValues = async (webview: DashboardWebview, connectionId: string, table: DatabaseTable, column: DatabaseColumn, filter: string) => {
    const dbValues = await getMssqlDbColumnValues(connectionId, table, column, filter);
    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        //errors: dbValues.errors,
        values: dbValues,
        table: table,
        column: column
    });
}


const loadRows = async (webview: DashboardWebview, connectionId: string, table: DatabaseTable, filter: string) => {
    const dbRows = await getMssqlDbTableRows(connectionId, table, filter);
    let columns: string[] = [];

    if (dbRows.count > 0) {
        for(var column in dbRows.rows[0]) {
            columns.push(column);
        }
    }

    let values: any[] = [];
    dbRows.rows.forEach(row => {
        let rowValues: any[] = [];
        columns.forEach(column => {
            rowValues.push(row[column]);
        });
        values.push(rowValues);
    });

    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        //errors: dbRows.errors,
        rowsHeader: columns,
        rows: values,
        count: dbRows.count,
        table: table
    });
}
