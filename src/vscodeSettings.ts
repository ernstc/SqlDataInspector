import * as vscode from 'vscode';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_VIEW_HORIZONTAL_SPLIT = 40;

const configKeys = {
    COLUMNS_ORDER_ALPHABETICALLY: "sqlDataInspector.columns.orderAlphabetically",
    COLUMNS_SHOW_PRIMARY_KEY_FIRST: "sqlDataInspector.columns.showPrimaryKeyFirst",
    LIVE_MONITORING_REFRESH_INTERVAL: "sqlDataInspector.liveMonitoringRefreshInterval",
    PAGE_SIZE: "sqlDataInspector.pageSize",
    SHOW_TABLES: "sqlDataInspector.showTables",
    SHOW_VIEWS: "sqlDataInspector.showViews",
    VIEW_HORIZONTAL_SPLIT: "sqlDataInspector.viewHorizontalSplit",
};

export interface IVscodeSettings {
    columnsOrderAlphabetically: boolean;
    columnsShowPrimaryKeyFirst: boolean;
    liveMonitoringRefreshInterval: boolean;
    pageSize: number;
    showTables: boolean;
    showViews: boolean;
    viewHorizontalSplit: number;
    setLiveMonitoringRefreshInterval(value: boolean): Promise<void>;
    setPageSize(value: number | undefined): Promise<void>;
    setShowTables(value: boolean): Promise<void>;
    setShowViews(value: boolean): Promise<void>;
    setViewHorizontalSplit(value: number | undefined): Promise<void>;
}

export class VscodeSettings implements IVscodeSettings {
    public static getInstance(): IVscodeSettings {
        if (!VscodeSettings._instance) {
            VscodeSettings._instance = new VscodeSettings();
        }
        return VscodeSettings._instance;
    }

    private static _instance: IVscodeSettings;
    private constructor() {
    }

    public get columnsOrderAlphabetically(): boolean {
        return this.getConfigValue<boolean>(configKeys.COLUMNS_ORDER_ALPHABETICALLY);
    }

    public get columnsShowPrimaryKeyFirst(): boolean {
        return this.getConfigValue<boolean>(configKeys.COLUMNS_SHOW_PRIMARY_KEY_FIRST);
    }

    public get liveMonitoringRefreshInterval(): boolean {
        return this.getConfigValue<boolean>(configKeys.LIVE_MONITORING_REFRESH_INTERVAL);
    }

    public get pageSize(): number {
        const value = this.getConfigValue<string>(configKeys.PAGE_SIZE);
        try {
            return parseInt(value, 10);
        }
        catch {
            return DEFAULT_PAGE_SIZE;
        }
    }

    public get showTables(): boolean {
        return this.getConfigValue<boolean>(configKeys.SHOW_TABLES);
    }

    public get showViews(): boolean {
        return this.getConfigValue<boolean>(configKeys.SHOW_VIEWS);
    }

    public get viewHorizontalSplit(): number {
        const value = this.getConfigValue<number>(configKeys.VIEW_HORIZONTAL_SPLIT);
        return value || DEFAULT_VIEW_HORIZONTAL_SPLIT;
    }

    public setLiveMonitoringRefreshInterval(value: boolean): Promise<void> {
        return this.setConfigValue(configKeys.LIVE_MONITORING_REFRESH_INTERVAL, value, true);
    }

    public setPageSize(value: number | undefined): Promise<void> {
        const configValue = (value || DEFAULT_PAGE_SIZE).toString();
        return this.setConfigValue(configKeys.PAGE_SIZE, configValue, true);
    }

    public setShowTables(value: boolean): Promise<void> {
        return this.setConfigValue(configKeys.SHOW_TABLES, value, true);
    }

    public setShowViews(value: boolean): Promise<void> {
        return this.setConfigValue(configKeys.SHOW_VIEWS, value, true);
    }

    public setViewHorizontalSplit(value: number | undefined): Promise<void> {
        const configValue = value || DEFAULT_VIEW_HORIZONTAL_SPLIT;
        return this.setConfigValue(configKeys.VIEW_HORIZONTAL_SPLIT, configValue, true);
    }

    private getConfigValue<T>(key: string): T {
        const workspaceConfig = vscode.workspace.getConfiguration();
        return workspaceConfig.get<T>(key)!;
    }

    private async setConfigValue<T>(key: string, value: T, global: boolean = true) {
        const workspaceConfig = vscode.workspace.getConfiguration();
        await workspaceConfig.update(key, value, global);
    }
}