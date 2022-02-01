import { DatabaseColumnValue } from './../models/database-columnValue.model';
import { getMssqlDbColumnValuesWithCount, getMssqlDbTableRowsCount } from './../repositories/mssql.repository';
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
    index?: number;
}


interface IOutgoingMessage {
    status?: string;
    errors?: any[];
    databaseName?: string;
    tables?: DatabaseTable[];
    columns?: DatabaseColumn[];
    values?: DatabaseColumnValue[];
    rows?: DatabaseTableRow[];
    rowsColumnsName?: string[];
    table?: DatabaseTable;
    column?: DatabaseColumn;
    tableIndex?: number;
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
                    case 'loadRowsCount': {
                        await loadRowsCount(connectionId, webview, viewModel, data.index!);
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
                viewModel.selectedTableIndex = vmUpdates?.selectedTableIndex != -1 ? vmUpdates?.selectedTableIndex : undefined;
                break;
            case 'selectedColumnIndex':
                viewModel.selectedColumnIndex = vmUpdates?.selectedColumnIndex != -1 ? vmUpdates?.selectedColumnIndex : undefined;
                break;
            case 'selectedRowRowIndex':
                viewModel.selectedRowRowIndex = vmUpdates?.selectedRowRowIndex != -1 ? vmUpdates?.selectedRowRowIndex : undefined;
                break;
            case 'selectedRowColumnIndex':
                viewModel.selectedRowColumnIndex = vmUpdates?.selectedRowColumnIndex != -1 ? vmUpdates?.selectedRowColumnIndex : undefined;
                break;
            case 'selectedValueIndex':
                viewModel.selectedValueIndex = vmUpdates?.selectedValueIndex != -1 ? vmUpdates?.selectedValueIndex : undefined;
                break;
            case 'filter':
                viewModel.filter = vmUpdates?.filter;
                break;
            case 'autoApply':
                viewModel.autoApply = vmUpdates?.autoApply;
                break;
            case 'liveMonitoring':
                viewModel.liveMonitoring = vmUpdates?.liveMonitoring;
                break;
            case 'refreshTimer':
                viewModel.refreshTimer = vmUpdates?.refreshTimer;
                break;
            case 'showRecordDetails':
                viewModel.showRecordDetails = vmUpdates?.showRecordDetails;
                break;
            case 'sortAscendingColumnValues':
                viewModel.sortAscendingColumnValues = vmUpdates?.sortAscendingColumnValues;
                break;
            case 'sortAscendingColumnValuesCount':
                viewModel.sortAscendingColumnValuesCount = vmUpdates?.sortAscendingColumnValuesCount;
                break;
            case 'filterTablesSchema':
                viewModel.filterTablesSchema = vmUpdates?.filterTablesSchema;
                break;
        }
    }
};


const loadTables = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    webview.postMessage({
        status: Status.GettingTableData,
    });

    viewModel.tables = await getMssqlDbTables(connectionId);
    viewModel.tablesSchema = [...new Set(viewModel.tables.map(t => t.Schema))];
    viewModel.columns = undefined;
    viewModel.values = undefined;
    viewModel.rowsColumnsName = undefined;
    viewModel.rows = undefined;
    viewModel.rowsCount = undefined;
    viewModel.selectedTableIndex = undefined;
    viewModel.selectedColumnIndex = undefined;
    viewModel.selectedValueIndex = undefined;
    viewModel.selectedRowRowIndex = undefined;
    viewModel.selectedRowColumnIndex = undefined;

    if (viewModel.filterTablesSchema != undefined
        && viewModel.filterTablesSchema != '*') {
        viewModel.tables = viewModel.tables.filter(t => t.Schema == viewModel.filterTablesSchema);

        //viewModel.columns = undefined;
        //viewModel.values = undefined;
        //viewModel.rowsColumnsName = undefined;
        //viewModel.rows = undefined
        //viewModel.rowsCount = undefined;
        //viewModel.selectedTableIndex = undefined;
        //viewModel.selectedColumnIndex = undefined;
        //viewModel.selectedValueIndex = undefined;
        //viewModel.selectedRowRowIndex = undefined;
        //viewModel.selectedRowColumnIndex = undefined;

        webview.postMessage({
            status: Status.RenderingData,
            tables: viewModel.tables,
            tablesSchema: viewModel.tablesSchema,
            columns: undefined,
            values: undefined,
            rows: undefined
        });
    }
    else {
        webview.postMessage({
            status: Status.RenderingData,
            tables: viewModel.tables,
            tablesSchema: viewModel.tablesSchema
        });
    }
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

    viewModel.values = await getMssqlDbColumnValuesWithCount(
        connectionId, 
        table, column, 
        viewModel.filter!, 
        viewModel.sortAscendingColumnValues, 
        viewModel.sortAscendingColumnValuesCount
        );

    viewModel.selectedValueIndex = undefined;
    
    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        values: viewModel.values,
        table: table,
        column: column,
        sortAscendingColumnValues: viewModel.sortAscendingColumnValues, 
        sortAscendingColumnValuesCount: viewModel.sortAscendingColumnValuesCount
    });
};


const loadRows = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const table = viewModel.selectedTable!;
    const dbRows = await getMssqlDbTableRows(connectionId, table, viewModel.filter!);
    table.Count = dbRows.count.toString();
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
        table: table,
        tableIndex: viewModel.tables?.indexOf(table)
    });
};


const loadRowsCount = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel, index: number) => {
    const table = viewModel.tables ? viewModel.tables[index] : undefined;
    if (table == undefined) {
        return;
    }

    const dbRowsCount = await getMssqlDbTableRowsCount(connectionId, table, viewModel.filter!);
    table.Count = dbRowsCount.count.toString();

    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        table: table,
        tableIndex: index
    });
};