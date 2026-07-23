import * as vscode from "vscode";
import { FQName } from "./FQName";
import { IDbRepository } from "./repositories/db.repository";
import { VscodeSettings } from "./vscodeSettings";

export type DbProviderType = "MSSQL" | "MySQL" | "PGSQL";

export interface MssqlConnectionInfo {
    server: string;
    database?: string;
    profileName?: string;
    [property: string]: unknown;
}

interface MssqlDbColumn {
    columnName: string;
}

interface MssqlDbCellValue {
    displayValue: string;
    isNull: boolean;
}

interface MssqlSimpleExecuteResult {
    columnInfo: MssqlDbColumn[];
    rows: MssqlDbCellValue[][];
}

interface MssqlExtensionApi {
    promptForConnection(ignoreFocusOut?: boolean): Promise<MssqlConnectionInfo | undefined>;
    connect(connectionInfo: MssqlConnectionInfo, saveConnection?: boolean): Promise<string>;
    connectionSharing: {
        executeSimpleQuery(connectionUri: string, queryString: string): Promise<MssqlSimpleExecuteResult>;
    };
}

interface MssqlObjectExplorerNode {
    connectionProfile?: MssqlConnectionInfo;
    metadata?: {
        name?: string;
        metadataTypeName?: string;
    };
    parentNode?: MssqlObjectExplorerNode;
}

export class ConnectionContext {

    private static readonly output = vscode.window.createOutputChannel("SQL Data Inspector", { log: true });

    public static initialize(context: vscode.ExtensionContext) {
        context.subscriptions.push(ConnectionContext.output);
        ConnectionContext.output.info("SQL Data Inspector activated.");
    }

    public readonly connection: { providerName: DbProviderType };
    public readonly connectionId: string;
    public readonly connectionSelector: string;
    public readonly fqname: FQName;
    public repository?: IDbRepository;

    public constructor(
        public readonly connectionProfile: MssqlConnectionInfo,
        private readonly mssqlApi: MssqlExtensionApi,
        connectionUri: string,
        fqname: FQName,
        label: string
    ) {
        this.fqname = fqname;
        this.connectionId = connectionUri;
        this.connectionSelector = connectionProfile.profileName || label;
        this.connection = {
            providerName: "MSSQL"
        };
    }

    public async runQueryAndReturn(query: string): Promise<Record<string, unknown>[]> {
        const traceSql = VscodeSettings.getInstance().traceSqlCommands;
        if (traceSql) {
            ConnectionContext.output.info(
                `SQL command [${this.connectionSelector} / ${this.connectionId}]:\n${query}`
            );
        }
        let result: MssqlSimpleExecuteResult;
        try {
            result = await this.mssqlApi.connectionSharing.executeSimpleQuery(
                this.connectionId,
                query
            );
        }
        catch (error) {
            ConnectionContext.output.error(error as Error);
            throw new Error(
                `MSSQL query execution failed. ${(error as Error).message}`
            );
        }

        if (!result) {
            throw new Error("The MSSQL extension did not return a query result.");
        }

        if (traceSql) {
            ConnectionContext.output.info(
                `SQL result:\n${JSON.stringify(result, null, 2)}`
            );
        }

        return result.rows.map(row => Object.fromEntries(
            result.columnInfo.map((column, index) => [
                column.columnName,
                row[index]?.isNull ? null : row[index]?.displayValue
            ])
        ));
    }

    public static getObjectExplorerConnectionProfile(node: unknown): MssqlConnectionInfo | undefined {
        if (!node || typeof node !== "object") {
            return undefined;
        }

        const objectExplorerNode = node as MssqlObjectExplorerNode;
        const connectionProfile = objectExplorerNode.connectionProfile;
        if (!connectionProfile || typeof connectionProfile.server !== "string" || !connectionProfile.server) {
            return undefined;
        }

        let database = connectionProfile.database;
        let currentNode: MssqlObjectExplorerNode | undefined = objectExplorerNode;
        while (currentNode) {
            if (currentNode.metadata?.metadataTypeName === "Database" && currentNode.metadata.name) {
                database = currentNode.metadata.name;
                break;
            }
            currentNode = currentNode.parentNode;
        }

        return {
            ...connectionProfile,
            database
        };
    }

    public static async select(
        fqname: FQName,
        selectedConnectionInfo?: MssqlConnectionInfo
    ): Promise<ConnectionContext | undefined> {
        const extension = vscode.extensions.getExtension<MssqlExtensionApi>("ms-mssql.mssql");
        if (!extension) {
            throw new Error("The SQL Server (mssql) extension is not installed.");
        }

        const mssqlApi = await extension.activate();
        const connectionInfo = selectedConnectionInfo ?? await mssqlApi.promptForConnection(true);
        if (!connectionInfo) {
            return undefined;
        }

        const connectionUri = await mssqlApi.connect(connectionInfo);
        const label = connectionInfo.profileName || connectionInfo.database || connectionInfo.server;

        fqname.serverName ??= connectionInfo.server;
        fqname.databaseName ??= connectionInfo.database;
        return new ConnectionContext(connectionInfo, mssqlApi, connectionUri, fqname, label);
    }

    public static getSelectedEditorText() {
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
            return;
        }

        const textRange = !editor.selection.isEmpty
            ? editor.selection
            : editor.document.getWordRangeAtPosition(editor.selection.active);
        if (textRange === undefined) {
            return;
        }
        return editor.document.getText(textRange);
    }

}