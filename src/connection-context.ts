import * as vscode from "vscode";
import { FQName } from "./FQName";
import { IDbRepository } from "./repositories/db.repository";
import { VscodeSettings } from "./vscodeSettings";

export type DbProviderType = "MSSQL" | "MySQL" | "PGSQL";

export interface MssqlConnectionInfo {
    id?: string;
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
    connectionSharing: {
        connect(extensionId: string, connectionId: string, database?: string): Promise<string | undefined>;
        disconnect(connectionUri: string): void;
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

    public dispose(): void {
        this.mssqlApi.connectionSharing.disconnect(this.connectionId);
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
        extensionId: string,
        selectedConnectionInfo?: MssqlConnectionInfo
    ): Promise<ConnectionContext | undefined> {
        const extension = vscode.extensions.getExtension<MssqlExtensionApi>("ms-mssql.mssql");
        if (!extension) {
            throw new Error("The SQL Server (mssql) extension is not installed.");
        }

        const mssqlApi = await extension.activate();
        if (typeof mssqlApi?.connectionSharing?.connect !== "function"
            || typeof mssqlApi.connectionSharing.executeSimpleQuery !== "function"
            || typeof mssqlApi.connectionSharing.disconnect !== "function") {
            throw new Error("The SQL Server (mssql) connection-sharing API is unavailable. Update the MSSQL extension and reload VS Code.");
        }

        const connectionInfo = selectedConnectionInfo ?? await ConnectionContext.promptForConnection();
        if (!connectionInfo) {
            return undefined;
        }
        if (!connectionInfo.id) {
            throw new Error("This MSSQL connection has no saved profile ID. Save the connection in SQL Server Object Explorer and try again.");
        }

        const database = fqname.databaseName ?? connectionInfo.database;
        const connectionUri = await mssqlApi.connectionSharing.connect(extensionId, connectionInfo.id, database);
        if (!connectionUri) {
            throw new Error("The MSSQL extension did not establish a connection.");
        }
        const label = connectionInfo.profileName || connectionInfo.database || connectionInfo.server;

        fqname.serverName ??= connectionInfo.server;
        fqname.databaseName ??= database;
        return new ConnectionContext({ ...connectionInfo, database }, mssqlApi, connectionUri, fqname, label);
    }

    private static async promptForConnection(): Promise<MssqlConnectionInfo | undefined> {
        const settings = vscode.workspace.getConfiguration("mssql").inspect<unknown[]>("connections");
        // MSSQL combines user and workspace profiles rather than overriding the user list.
        const profiles = [...(settings?.globalValue ?? []), ...(settings?.workspaceValue ?? [])];
        const connections = profiles.filter((profile): profile is MssqlConnectionInfo => {
            if (!profile || typeof profile !== "object") {
                return false;
            }
            const connection = profile as Partial<MssqlConnectionInfo>;
            return typeof connection.id === "string" && connection.id.length > 0
                && typeof connection.server === "string" && connection.server.length > 0;
        });
        if (connections.length === 0) {
            throw new Error("No saved MSSQL connections are available. Create a connection in SQL Server Object Explorer and try again.");
        }

        const selected = await vscode.window.showQuickPick(connections.map(connection => ({
            label: connection.profileName || connection.server,
            description: connection.database,
            detail: connection.server,
            connection
        })), {
            placeHolder: "Select a SQL Server connection to inspect",
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true
        });
        return selected?.connection;
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