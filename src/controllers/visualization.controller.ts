import * as azdata from "azdata";
import * as vscode from 'vscode';
import { DatabaseColumn } from "../models/database-column.model";
import { DatabaseColumnValue } from '../models/database-columnValue.model';
import { DatabaseInfo } from "../models/database-info.model";
import { DatabaseObject } from '../models/database-object.model';
import { DatabaseTableRow } from "../models/database-table-row.model";
import { loadWebView } from "../web.loader";
import { Status } from "../models/status.enum";
import { IDbRepository } from './../repositories/db.repository';
import { ViewModel } from "../models/view.model";
import { ConnectionContext } from '../connection-context';
import { VscodeSettings } from "../vscodeSettings";


interface IIncomingMessage {
    command: string;
    item?: any;
    viewModel?: ViewModel;
    index?: number;
    rowsPageIndex?: string;
}


interface IOutgoingMessage {
    status?: string;
    databaseInfo?: DatabaseInfo;
    errors?: any[];
    serverName?: string;
    databaseName?: string;
    objects?: DatabaseObject[];
    objectsSchema?: string[];
    columns?: DatabaseColumn[];
    selectedColumnIndex?: number;
    sortColumnNames?: string;
    values?: DatabaseColumnValue[];
    rows?: DatabaseTableRow[];
    rowsColumnsName?: string[];
    rowsCount?: number;
    rowsPageIndex?: number;
    object?: DatabaseObject;
    objectIndex?: number;
    column?: DatabaseColumn;
    viewModel?: ViewModel;
    sortAscendingColumnValues?: boolean;
    sortAscendingColumnValuesCount?: boolean;
    sortRowsByColumnName?: string;
    sortRowsByColumnAscending?: boolean;
    filterObjectsSchema?: string;
}

export const VisualizationController = async (webview: vscode.Webview, connectionContext: ConnectionContext) => {
    await renderWebviewContent(webview, connectionContext);
};


const postMessage = (webview: azdata.DashboardWebview | vscode.Webview, message: IOutgoingMessage) => {
    webview.postMessage(message);
};


const renderWebviewContent = async (webview: vscode.Webview, connectionContext: ConnectionContext) => {
    webview.html = loadWebView();
    if (/*connectionContext.connection?.options.database &&*/ connectionContext.connectionId) {

        let vscodeSettings = VscodeSettings.getInstance();
        let viewModel = new ViewModel();
        viewModel.serverName = connectionContext.fqname.serverName;
        viewModel.databaseName = connectionContext.fqname.databaseName;
        viewModel.startWithObject = connectionContext.fqname;
        viewModel.autoApply = true;
        viewModel.selectTables = vscodeSettings.showTables;
        viewModel.selectViews = vscodeSettings.showViews;
        viewModel.rowsPageIndex = 1;
        viewModel.rowsPageSize = vscodeSettings.pageSize;
        viewModel.filtersPanelOpen = false;

        webview.onDidReceiveMessage(async (data: IIncomingMessage) => {
            const repository: IDbRepository = connectionContext.repository!;
            const commands = data.command.split('|');
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
                    case 'databaseInfo': {
                        await getDatabaseInfo(repository, webview, viewModel);
                        break;
                    }
                    case 'loadObjects': {
                        await loadObjects(repository, webview, viewModel);
                        // also load the columns and rows when starting with a selected table
                        if (connectionContext.fqname.tableName !== undefined) {
                            await loadColumns(repository, webview, viewModel);
                            await loadRows(repository, webview, viewModel);
                        }
                        break;
                    }
                    case 'loadColumns': {
                        await loadColumns(repository, webview, viewModel);
                        break;
                    }
                    case 'reorderColumns': {
                        await reorderColumns(repository, webview, viewModel);
                        break;
                    }
                    case 'loadValues': {
                        await loadValues(repository, webview, viewModel);
                        break;
                    }
                    case 'loadRows': {
                        await loadRows(repository, webview, viewModel);
                        break;
                    }
                    case 'loadRowsCount': {
                        await loadRowsCount(repository, webview, viewModel, data.index!);
                        break;
                    }
                    case 'copyText': {
                        vscode.env.clipboard.writeText(data.item);
                        break;
                    }
                    case 'showMessage': {
                        vscode.window.showInformationMessage(data.item);
                        break;
                    }
                    case 'changeRowsPage': {
                        if (
                            data.rowsPageIndex !== undefined
                            && viewModel.rowsCount !== undefined
                            && viewModel.rowsPageIndex !== undefined
                            && viewModel.rowsPageSize !== undefined
                        ) {
                            const pagesCount = Math.ceil(viewModel.rowsCount / viewModel.rowsPageSize);
                            let pageIndex: number;
                            switch (data.rowsPageIndex) {
                                case 'first': {
                                    pageIndex = 1;
                                    break;
                                }
                                case 'prev': {
                                    pageIndex = viewModel.rowsPageIndex - 1;
                                    if (pageIndex < 1) { pageIndex = 1; }
                                    break;
                                }
                                case 'next': {
                                    pageIndex = viewModel.rowsPageIndex + 1;
                                    if (pageIndex > pagesCount) { pageIndex = pagesCount; }
                                    break;
                                }
                                case 'last': {
                                    pageIndex = pagesCount;
                                    break;
                                }
                                default: {
                                    pageIndex = parseInt(data.rowsPageIndex);
                                }
                            }
                            viewModel.rowsPageIndex = pageIndex;
                            await loadRows(repository, webview, viewModel);
                        }
                    }
                }
            }
        });
    }
    else {
        postMessage(webview, {
            status: Status.NoDatabase,
        });
    }
};


const setViewModel = async (webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    postMessage(webview, {
        viewModel: {
            ...viewModel,
            selectedObject: viewModel.selectedObject,
            selectedColumn: viewModel.selectedColumn,
            selectedValue: viewModel.selectedValue,
            selectedRow: viewModel.selectedRow
        }
    });
};


const updateViewModel = (viewModel: ViewModel, vmUpdates?: ViewModel) => {
    let vscodeSettings = VscodeSettings.getInstance();
    for (let key in vmUpdates) {
        switch (key) {
            case 'selectedObjectIndex':
                viewModel.selectedObjectIndex = vmUpdates?.selectedObjectIndex !== -1 ? vmUpdates?.selectedObjectIndex : undefined;
                break;
            case 'selectedColumnIndex':
                viewModel.selectedColumnIndex = vmUpdates?.selectedColumnIndex !== -1 ? vmUpdates?.selectedColumnIndex : undefined;
                break;
            case 'selectedRowRowIndex':
                viewModel.selectedRowRowIndex = vmUpdates?.selectedRowRowIndex !== -1 ? vmUpdates?.selectedRowRowIndex : undefined;
                break;
            case 'selectedRowColumnIndex':
                viewModel.selectedRowColumnIndex = vmUpdates?.selectedRowColumnIndex !== -1 ? vmUpdates?.selectedRowColumnIndex : undefined;
                break;
            case 'selectedValueIndex':
                viewModel.selectedValueIndex = vmUpdates?.selectedValueIndex !== -1 ? vmUpdates?.selectedValueIndex : undefined;
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
            case 'sortColumnNames':
                viewModel.sortColumnNames = vmUpdates?.sortColumnNames;
                break;
            case 'values':
                viewModel.values = vmUpdates?.values;
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
                vscodeSettings.setShowTables(vmUpdates?.selectTables ?? true);
                viewModel.selectTables = vmUpdates?.selectTables;
                break;
            case 'selectViews':
                vscodeSettings.setShowViews(vmUpdates?.selectViews ?? true);
                viewModel.selectViews = vmUpdates?.selectViews;
                break;
            case 'rowsPageIndex':
                viewModel.rowsPageIndex = vmUpdates?.rowsPageIndex;
                break;
            case 'rowsPageSize':
                vscodeSettings.setPageSize(vmUpdates?.rowsPageSize);
                viewModel.rowsPageSize = vmUpdates?.rowsPageSize;
                break;
            case 'sortRowsByColumnName':
                viewModel.sortRowsByColumnName = vmUpdates?.sortRowsByColumnName;
                break;
            case 'sortRowsByColumnAscending':
                viewModel.sortRowsByColumnAscending = vmUpdates?.sortRowsByColumnAscending;
                break;
            case 'searchObjectName':
                viewModel.searchObjectName = vmUpdates?.searchObjectName;
                break;
            case 'filtersPanelOpen':
                viewModel.filtersPanelOpen = vmUpdates?.filtersPanelOpen;
                break;
            case 'databaseInfo':
                viewModel.databaseInfo = vmUpdates?.databaseInfo;
                break;
        }
    }
};


const getDatabaseInfo = async (repository: IDbRepository, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    if (viewModel.databaseInfo === undefined) {
        const databaseInfo = await repository.getDatabaseInfo();
        viewModel.databaseInfo = databaseInfo;
    }
    postMessage(webview, {
        status: Status.GettingObjectsData,
        databaseInfo: viewModel.databaseInfo
    });
};


const loadObjects = async (repository: IDbRepository, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    postMessage(webview, {
        status: Status.GettingObjectsData,
    });

    viewModel.objects = await repository.getDbObjects();
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
    viewModel.rowsPageIndex = 1;

    if (viewModel.startWithObject !== undefined && viewModel.startWithObject.tableName !== undefined) {
        let selectedIndex: number;
        if (viewModel.startWithObject.schemaName !== undefined) {
            let schema = viewModel.startWithObject.schemaName.toLowerCase();
            let name = viewModel.startWithObject.tableName.toLowerCase();
            selectedIndex = viewModel.objects.findIndex(o => o.Schema.toLowerCase() === schema && o.Name.toLowerCase() === name);
        }
        else {
            let name = viewModel.startWithObject.tableName.toLowerCase();
            selectedIndex = viewModel.objects.findIndex(o => o.Name.toLowerCase() === name);
        }

        if (selectedIndex >= 0) {
            viewModel.selectedObjectIndex = selectedIndex;
            postMessage(webview, {
                status: Status.RenderingData,
                objects: viewModel.objects,
                objectsSchema: viewModel.objectsSchema,
                objectIndex: viewModel.selectedObjectIndex,
                filterObjectsSchema: viewModel.filterObjectsSchema
            });
            return;
        }
        else {
            viewModel.startWithObject = undefined;
        }
    }

    if (viewModel.filterObjectsSchema !== undefined
        && viewModel.filterObjectsSchema !== '*') {
        viewModel.objects = viewModel.objects.filter(t => t.Schema === viewModel.filterObjectsSchema);

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

        postMessage(webview, {
            status: Status.RenderingData,
            objects: viewModel.objects,
            objectsSchema: viewModel.objectsSchema,
            filterObjectsSchema: viewModel.filterObjectsSchema,
            objectIndex: viewModel.selectedObjectIndex,
            columns: undefined,
            values: undefined,
            rows: undefined
        });
    }
    else {
        postMessage(webview, {
            status: Status.RenderingData,
            objects: viewModel.objects,
            objectsSchema: viewModel.objectsSchema,
            filterObjectsSchema: viewModel.filterObjectsSchema
        });
    }
};


const loadColumns = async (repository: IDbRepository, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const object = viewModel.selectedObject!;

    viewModel.columns = await repository.getDbColumns(object, viewModel.sortColumnNames);
    viewModel.values = undefined;
    viewModel.selectedColumnIndex = undefined;
    viewModel.selectedValueIndex = undefined;

    postMessage(webview, {
        status: Status.RenderingData,
        columns: viewModel.columns,
        sortColumnNames: viewModel.sortColumnNames,
        object: object
    });
};


const reorderColumns = async (repository: IDbRepository, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const object = viewModel.selectedObject!;

    const selectedColumnName = (viewModel.columns != undefined && viewModel.selectedColumnIndex != undefined) ? 
        viewModel.columns![viewModel.selectedColumnIndex!].Name :
        undefined;

    viewModel.columns = await repository.getDbColumns(object, viewModel.sortColumnNames);

    viewModel.selectedColumnIndex = selectedColumnName != undefined ? 
        viewModel.columns.findIndex(c => c.Name === selectedColumnName) :
        undefined;

    postMessage(webview, {
        status: Status.RenderingData,
        columns: viewModel.columns,
        selectedColumnIndex: viewModel.selectedColumnIndex,
        sortColumnNames: viewModel.sortColumnNames,
        object: object
    });
};


const loadValues = async (repository: IDbRepository, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    const object = viewModel.selectedObject!;
    const column = viewModel.selectedColumn!;

    viewModel.values = await repository.getDbColumnValuesWithCount(
        object, column,
        viewModel.filter!,
        viewModel.sortAscendingColumnValues,
        viewModel.sortAscendingColumnValuesCount
    );

    viewModel.selectedValueIndex = undefined;

    postMessage(webview, {
        status: Status.RenderingData,
        values: viewModel.values,
        object: object,
        column: column,
        sortAscendingColumnValues: viewModel.sortAscendingColumnValues,
        sortAscendingColumnValuesCount: viewModel.sortAscendingColumnValuesCount
    });
};


const loadRows = async (repository: IDbRepository, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel) => {
    if (viewModel.selectedObject === undefined) {
        await setViewModel(webview, viewModel);
        return;
    }

    const object = viewModel.selectedObject;

    let orderByColumns: string[] | undefined;
    let sortAscending: boolean[] | undefined;

    if (viewModel.sortRowsByColumnName) {
        orderByColumns = [viewModel.sortRowsByColumnName];
        if (viewModel.sortRowsByColumnAscending !== undefined) {
            sortAscending = [viewModel.sortRowsByColumnAscending];
        }
        else {
            sortAscending = [true];
        }
    }
    else {
        const primaryKey = viewModel.columns?.filter(c => c.IsPrimaryKey)
            .sort((c1, c2) => c1.KeyOrdinal <= c2.KeyOrdinal ? -1 : 1)
            .map(c => c.Name);
        orderByColumns = primaryKey;
        sortAscending = primaryKey?.map(p => true);
    }

    const dbRows = await repository.getDbTableRows(object, viewModel.columns, viewModel.filter!, orderByColumns, sortAscending, viewModel.rowsPageIndex, viewModel.rowsPageSize);
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

    postMessage(webview, {
        status: Status.RenderingData,
        rowsColumnsName: columnsName,
        rows: values,
        rowsCount: dbRows.count,
        rowsPageIndex: viewModel.rowsPageIndex,
        sortRowsByColumnName: viewModel.sortRowsByColumnName,
        sortRowsByColumnAscending: viewModel.sortRowsByColumnAscending,
        object: object,
        objectIndex: viewModel.objects?.indexOf(object)
    });
};


const loadRowsCount = async (repository: IDbRepository, webview: azdata.DashboardWebview | vscode.Webview, viewModel: ViewModel, index: number) => {
    const object = viewModel.objects ? viewModel.objects[index] : undefined;
    if (object === undefined) {
        return;
    }

    const dbRowsCount = await repository.getDbTableRowsCount(object, viewModel.filter!);
    object.Count = dbRowsCount.count.toString();

    postMessage(webview, {
        status: Status.RenderingData,
        object: object,
        objectIndex: index
    });
};

