import * as azdata from "azdata";
import * as vscode from 'vscode';
import { visualizationPanelName } from "../constants";
import { DatabaseTable } from './../models/database-table.model';
import { loadWebView } from "../web.loader";
import { Status } from "../models/status.enum";
import { getMssqlDbTables, getMssqlDbColumns, getMssqlDbColumnValues, getMssqlDbTableRows } from "../repositories/mssql.repository";
import { DatabaseColumn } from "../models/database-column.model";
import { ViewModel } from "../models/view.model";


interface IIncomingMessage {
    command: string;
    item?: any;
    itemIndex?: number;
    viewModel?: ViewModel;
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


export const VisualizationController = (context: vscode.ExtensionContext) => {
    azdata.dashboard.registerWebviewProvider(
        visualizationPanelName,
        renderDashboardWebviewContent
    );
}


export const VisualizationPanelController = async (webview: vscode.Webview, connection: azdata.connection.Connection) => {
    await renderWebviewContent(webview, connection);
}


const renderDashboardWebviewContent = async (webview: azdata.DashboardWebview) => {
    webview.html = loadWebView();
    if (webview.connection.options.database) {

        webview.postMessage({
            status: Status.GettingTableData,
        });

        const databaseName = webview.connection.options.database;

        const connections = await azdata.connection.getActiveConnections();
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

        let viewModel = new ViewModel();

        webview.onMessage(async (data: IIncomingMessage) => {
            switch (data.command) {
                case 'viewIsReady': {
                    setViewModel(webview, viewModel);
                    break;
                }
                case 'viewUpdated': {
                    if (data.viewModel) {
                        viewModel = data.viewModel;
                    }
                    break;
                }
                /*
                case 'selectedTable': {
                    if (data.viewModel) {
                        viewModel = data.viewModel;
                    }
                    break;
                }
                case 'selectedColumn': {
                    if (data.viewModel) {
                        viewModel = data.viewModel;
                    }
                    break;
                }
                */
                
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
                /*     
                case 'changedFilter': {
                    filter = data.item;
                    break;
                }
                */
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
};


const renderWebviewContent = async (webview: vscode.Webview, connection: azdata.connection.Connection) => {
    webview.html = loadWebView();
    if (connection.options.database) {

        const databaseName = connection.options.database;
        const connectionId = connection.connectionId;

        /*webview.postMessage({
            databaseName: databaseName
        });*/

        let viewModel = new ViewModel();
        viewModel.databaseName = databaseName;

        webview.onDidReceiveMessage(async (data: IIncomingMessage) => {
            switch (data.command) {
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
        viewModel: viewModel
    });
};


const updateViewModel = (viewModel: ViewModel, vmUpdates?: ViewModel) => {
    if (vmUpdates) {
        if (vmUpdates.filter != undefined) viewModel.filter = vmUpdates.filter;
        if (vmUpdates.selectedColumnIndex != undefined) viewModel.selectedColumnIndex = vmUpdates.selectedColumnIndex;
        if (vmUpdates.selectedRowRowIndex != undefined) viewModel.selectedRowRowIndex = vmUpdates.selectedRowRowIndex;
        if (vmUpdates.selectedTableIndex != undefined) viewModel.selectedTableIndex = vmUpdates.selectedTableIndex;
        if (vmUpdates.selectedValueIndex != undefined) viewModel.selectedValueIndex = vmUpdates.selectedValueIndex;
        if (vmUpdates.autoApply != undefined) viewModel.autoApply = vmUpdates.autoApply;
    }
};


const loadTables = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    webview.postMessage({
        status: Status.GettingTableData,
    });
    viewModel.tables = await getMssqlDbTables(connectionId);
    webview.postMessage({
        status: Status.RenderingData,
        tables: viewModel.tables
    });
};


const loadColumns = async(connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const table = viewModel.selectedTable!;
    viewModel.columns = await getMssqlDbColumns(connectionId, table);
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

    viewModel.rowsHeader = columns;
    viewModel.rows = values;
    viewModel.rowsCount = dbRows.count;

    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        rowsHeader: columns,
        rows: values,
        count: dbRows.count,
        table: table
    });
};
