import * as azdata from "azdata";
import * as vscode from 'vscode';
import { DatabaseTable } from './../models/database-table.model';
import { DatabaseColumn } from "../models/database-column.model";
import { DatabaseTableRow } from "../models/database-table-row.model";
import { loadWebView } from "../web.loader";
import { Status } from "../models/status.enum";
import { getMssqlDbTables, getMssqlDbColumns, getMssqlDbColumnValues, getMssqlDbTableRows } from "../repositories/mssql.repository";
import { ViewModel } from "../models/view.model";


interface IIncomingMessage {
    command: string;
    item?: any;
    viewModel?: ViewModel;
}


interface IOutgoingMessage {
    status?: string;
    errors?: any[];
    databaseName?: string;
    tables?: DatabaseTable[];
    columns?: DatabaseColumn[];
    values?: string[];
    rows?: DatabaseTableRow[];
    rowsColumnsName?: string[];
    table?: DatabaseTable;
    column?: DatabaseColumn;
}



export const VisualizationController = async (webview: vscode.Webview, connection: azdata.connection.Connection) => {
    await renderWebviewContent(webview, connection);
}


const renderWebviewContent = async (webview: vscode.Webview, connection: azdata.connection.Connection) => {
    webview.html = loadWebView();
    if (connection.options.database) {

        const databaseName = connection.options.database;
        const connectionId = connection.connectionId;

        let viewModel = new ViewModel();
        viewModel.databaseName = databaseName;
        viewModel.autoApply = true;

        webview.onDidReceiveMessage(async (data: IIncomingMessage) => {
            let commands = data.command.split('|');
            for (let i = 0; i < commands.length; i++) {
                switch (commands[i]) {
                    case 'viewIsReady': {
                        setViewModel(webview, viewModel);
                        break;
                    }
                    case 'viewUpdated': {
                        updateViewModel(viewModel, data.viewModel);
                        break;
                    }
                    case 'loadTables': {
                        await loadTables(connectionId, webview, viewModel);
                        break;
                    }
                    case 'loadColumns': {
                        await loadColumns(connectionId, webview, viewModel);
                        break;
                    }
                    case 'loadValues': {
                        await loadValues(connectionId, webview, viewModel);
                        break;
                    }
                    case 'loadRows': {
                        await loadRows(connectionId, webview, viewModel);
                        break;
                    }
                    case 'copyText': {
                        vscode.env.clipboard.writeText(data.item);
                        break;
                    }
                }
            }
        });
    }
    else {
        webview.postMessage({
            status: Status.NoDatabase,
        });
    }
};


const setViewModel = async (webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    webview.postMessage({
        viewModel: { 
            ...viewModel, 
            selectedTable: viewModel.selectedTable,
            selectedColumn: viewModel.selectedColumn,
            selectedValue: viewModel.selectedValue,
            selectedRow: viewModel.selectedRow
        }
    });
};


const updateViewModel = (viewModel: ViewModel, vmUpdates?: ViewModel) => {
    for (let key in vmUpdates) {
        switch (key) {
            case 'selectedTableIndex':
                viewModel.selectedTableIndex = vmUpdates.selectedTableIndex;
                break;
            case 'selectedColumnIndex':
                viewModel.selectedColumnIndex = vmUpdates.selectedColumnIndex;
                break;
            case 'selectedRowRowIndex':
                viewModel.selectedRowRowIndex = vmUpdates.selectedRowRowIndex;
                break;
            case 'selectedRowColumnIndex':
                viewModel.selectedRowColumnIndex = vmUpdates.selectedRowColumnIndex;
                break;
            case 'selectedValueIndex':
                viewModel.selectedValueIndex = vmUpdates.selectedValueIndex;
                break;
            case 'filter':
                viewModel.filter = vmUpdates.filter;
                break;
            case 'autoApply':
                viewModel.autoApply = vmUpdates.autoApply;
                break;
            case 'showRecordDetails':
                viewModel.showRecordDetails = vmUpdates.showRecordDetails;
                break;
        }
    }
};


const loadTables = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    webview.postMessage({
        status: Status.GettingTableData,
    });

    viewModel.tables = await getMssqlDbTables(connectionId);
    viewModel.columns = undefined;
    viewModel.values = undefined;
    viewModel.rows = undefined;
    viewModel.rowsCount = undefined;
    viewModel.selectedTableIndex = undefined;
    viewModel.selectedColumnIndex = undefined;
    viewModel.selectedValueIndex = undefined;
    viewModel.selectedRowRowIndex = undefined;
    viewModel.selectedRowColumnIndex = undefined;
    
    webview.postMessage({
        status: Status.RenderingData,
        tables: viewModel.tables
    });
};


const loadColumns = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const table = viewModel.selectedTable!;

    viewModel.columns = await getMssqlDbColumns(connectionId, table);
    viewModel.values = undefined;
    viewModel.selectedColumnIndex = undefined;
    viewModel.selectedValueIndex = undefined;

    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        columns: viewModel.columns,
        table: table
    });
};


const loadValues = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const table = viewModel.selectedTable!;
    const column = viewModel.selectedColumn!;

    viewModel.values = await getMssqlDbColumnValues(connectionId, table, column, viewModel.filter!);
    viewModel.selectedValueIndex = undefined;
    
    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        values: viewModel.values,
        table: table,
        column: column
    });
};


const loadRows = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const table = viewModel.selectedTable!;
    const dbRows = await getMssqlDbTableRows(connectionId, table, viewModel.filter!);
    let columnsName: string[] = [];

    if (dbRows.count > 0) {
        for (var column in dbRows.rows[0]) {
            columnsName.push(column);
        }
    }

    let values: DatabaseTableRow[] = [];
    dbRows.rows.forEach(row => {
        let rowValues: DatabaseTableRow = { Values: [] };
        columnsName.forEach(column => {
            rowValues.Values.push(row[column]);
        });
        values.push(rowValues);
    });

    viewModel.rowsColumnsName = columnsName;
    viewModel.rows = values;
    viewModel.rowsCount = dbRows.count;
    viewModel.selectedRowRowIndex = undefined;
    viewModel.selectedRowColumnIndex = undefined;

    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        rowsColumnsName: columnsName,
        rows: values,
        count: dbRows.count,
        table: table
    });
};
