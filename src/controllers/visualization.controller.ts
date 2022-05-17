import { DatabaseColumnValue } from '../models/database-columnValue.model';
import { getMssqlDbColumnValuesWithCount, getMssqlDbTableRowsCount } from './../repositories/mssql.repository';
import * as azdata from "azdata";
import * as vscode from 'vscode';
import { DatabaseObject } from '../models/database-object.model';
import { DatabaseColumn } from "../models/database-column.model";
import { DatabaseTableRow } from "../models/database-table-row.model";
import { loadWebView } from "../web.loader";
import { Status } from "../models/status.enum";
import { getMssqlDbObjects, getMssqlDbColumns, getMssqlDbColumnValues, getMssqlDbTableRows } from "../repositories/mssql.repository";
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
    objects?: DatabaseObject[];
    columns?: DatabaseColumn[];
    values?: DatabaseColumnValue[];
    rows?: DatabaseTableRow[];
    rowsColumnsName?: string[];
    object?: DatabaseObject;
    column?: DatabaseColumn;
    objectIndex?: number;
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
        viewModel.selectTables = true;
        viewModel.selectViews = true;

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
                    case 'loadObjects': {
                        await loadObjects(connectionId, webview, viewModel);
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
            selectedTable: viewModel.selectedObject,
            selectedColumn: viewModel.selectedColumn,
            selectedValue: viewModel.selectedValue,
            selectedRow: viewModel.selectedRow
        }
    });
};


const updateViewModel = (viewModel: ViewModel, vmUpdates?: ViewModel) => {
    for (let key in vmUpdates) {
        switch (key) {
            case 'selectedObjectIndex':
                viewModel.selectedObjectIndex = vmUpdates?.selectedObjectIndex != -1 ? vmUpdates?.selectedObjectIndex : undefined;
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
            case 'filterObjectsSchema':
                viewModel.filterObjectsSchema = vmUpdates?.filterObjectsSchema;
                break;
            case 'selectTables':
                viewModel.selectTables = vmUpdates?.selectTables;
                break;
            case 'selectViews':
                viewModel.selectViews = vmUpdates?.selectViews;
                break;
        }
    }
};


const loadObjects = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    webview.postMessage({
        status: Status.GettingObjectsData,
    });

    viewModel.objects = await getMssqlDbObjects(connectionId, viewModel.selectTables, viewModel.selectViews);
    viewModel.objectsSchema = [...new Set(viewModel.objects.map(t => t.Schema))];
    viewModel.columns = undefined;
    viewModel.values = undefined;
    viewModel.rowsColumnsName = undefined;
    viewModel.rows = undefined;
    viewModel.rowsCount = undefined;
    viewModel.selectedObjectIndex = undefined;
    viewModel.selectedColumnIndex = undefined;
    viewModel.selectedValueIndex = undefined;
    viewModel.selectedRowRowIndex = undefined;
    viewModel.selectedRowColumnIndex = undefined;

    if (viewModel.filterObjectsSchema != undefined
        && viewModel.filterObjectsSchema != '*') {
        viewModel.objects = viewModel.objects.filter(t => t.Schema == viewModel.filterObjectsSchema);

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
            objects: viewModel.objects,
            objectsSchema: viewModel.objectsSchema,
            columns: undefined,
            values: undefined,
            rows: undefined
        });
    }
    else {
        webview.postMessage({
            status: Status.RenderingData,
            objects: viewModel.objects,
            objectsSchema: viewModel.objectsSchema
        });
    }
};


const loadColumns = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const object = viewModel.selectedObject!;

    viewModel.columns = await getMssqlDbColumns(connectionId, object);
    viewModel.values = undefined;
    viewModel.selectedColumnIndex = undefined;
    viewModel.selectedValueIndex = undefined;

    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        columns: viewModel.columns,
        object: object
    });
};


const loadValues = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const object = viewModel.selectedObject!;
    const column = viewModel.selectedColumn!;

    viewModel.values = await getMssqlDbColumnValuesWithCount(
        connectionId, 
        object, column, 
        viewModel.filter!, 
        viewModel.sortAscendingColumnValues, 
        viewModel.sortAscendingColumnValuesCount
        );

    viewModel.selectedValueIndex = undefined;
    
    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        values: viewModel.values,
        object: object,
        column: column,
        sortAscendingColumnValues: viewModel.sortAscendingColumnValues, 
        sortAscendingColumnValuesCount: viewModel.sortAscendingColumnValuesCount
    });
};


const loadRows = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const object = viewModel.selectedObject!;
    const dbRows = await getMssqlDbTableRows(connectionId, object, viewModel.filter!);
    object.Count = dbRows.count.toString();
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
        object: object,
        objectIndex: viewModel.objects?.indexOf(object)
    });
};


const loadRowsCount = async (connectionId: string, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel, index: number) => {
    const object = viewModel.objects ? viewModel.objects[index] : undefined;
    if (object == undefined) {
        return;
    }

    const dbRowsCount = await getMssqlDbTableRowsCount(connectionId, object, viewModel.filter!);
    object.Count = dbRowsCount.count.toString();

    webview.postMessage(<IOutgoingMessage>{
        status: Status.RenderingData,
        object: object,
        objectIndex: index
    });
};