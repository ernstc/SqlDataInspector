import * as vscode from "vscode";
import { FQName } from "./FQName";
import { IDbRepository } from "./repositories/db.repository";
import { VscodeSettings } from "./vscodeSettings";

export type DbProviderType = "MSSQL" | "MySQL" | "PGSQL";

export interface SqlToolsConnection {
    id?: string;
    name: string;
    driver: string;
    server?: string;
    connectString?: string;
    isConnected?: boolean;
}

interface SqlToolsQueryResult {
    cols: string[];
    results: Record<string, unknown>[];
    error?: boolean;
    rawError?: Error;
}

export class ConnectionContext {

    private static readonly output = vscode.window.createOutputChannel("SQL Data Inspector", { log: true });

    public static initialize(context: vscode.ExtensionContext) {
        context.subscriptions.push(ConnectionContext.output);
        ConnectionContext.output.info("SQL Data Inspector activated.");
    }

    public readonly connection: { providerName: DbProviderType };
    public readonly connectionId: string;
    public readonly fqname: FQName;
    public repository?: IDbRepository;

    public constructor(
        public readonly connectionProfile: SqlToolsConnection,
        fqname: FQName
    ) {
        this.fqname = fqname;
        this.connectionId = ConnectionContext.getConnectionId(connectionProfile);
        this.connection = {
            providerName: ConnectionContext.getProvider(connectionProfile.driver)
        };
    }

    public async runQueryAndReturn(query: string): Promise<Record<string, unknown>[]> {
        const traceSql = VscodeSettings.getInstance().traceSqlCommands;
        if (traceSql) {
            ConnectionContext.output.info(
                `SQL command [${this.connectionProfile.name} / ${this.connectionId}]:\n${query}`
            );
        }
        let results: SqlToolsQueryResult[];
        try {
            results = await vscode.commands.executeCommand<SqlToolsQueryResult[]>(
                "sqltools.executeQuery",
                query,
                { connNameOrId: this.connectionId }
            );
        }
        catch (error) {
            ConnectionContext.output.error(error as Error);
            throw new Error(
                `SQLTools query execution failed. ${(error as Error).message}`
            );
        }

        if (!results) {
            throw new Error("SQLTools did not return a query result.");
        }

        if (traceSql) {
            ConnectionContext.output.info(
                `SQL result:\n${JSON.stringify(results, null, 2)}`
            );
        }

        const failedResult = results.find(result => result.error);
        if (failedResult) {
            throw failedResult.rawError ?? new Error("SQLTools query execution failed.");
        }

        const rows = results.flatMap(result => result.results);
        return rows;
    }

    public static async select(fqname: FQName): Promise<ConnectionContext | undefined> {
        const connections = await vscode.commands.executeCommand<SqlToolsConnection[]>(
            "sqltools.getConnections",
            { connectedOnly: false, sort: "connectedFirst" }
        );

        if (!connections?.length) {
            const addConnection = "Add SQLTools Connection";
            const selection = await vscode.window.showInformationMessage(
                "No SQLTools connections are configured.",
                addConnection
            );
            if (selection === addConnection) {
                await vscode.commands.executeCommand("sqltools.openAddConnectionScreen");
            }
            return undefined;
        }

        const supportedConnections = connections.filter(connection => {
            try {
                ConnectionContext.getProvider(connection.driver);
                return true;
            }
            catch {
                return false;
            }
        });

        if (!supportedConnections.length) {
            throw new Error("No supported SQLTools connection was found. Configure SQL Server, PostgreSQL, or MySQL.");
        }

        const selected = await vscode.window.showQuickPick(
            supportedConnections.map(connection => ({
                label: connection.name,
                description: connection.isConnected ? "Connected" : undefined,
                detail: [connection.server, connection.driver].filter(Boolean).join(" / "),
                connection
            })),
            {
                matchOnDescription: true,
                matchOnDetail: true,
                placeHolder: "Select a SQLTools connection"
            }
        );

        if (!selected) {
            return undefined;
        }

        fqname.serverName ??= selected.connection.server;
        fqname.databaseName ??= selected.connection.name;
        return new ConnectionContext(selected.connection, fqname);
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

    private static getProvider(driver: string): DbProviderType {
        const normalizedDriver = driver.toLowerCase();
        if (normalizedDriver.includes("mssql") || normalizedDriver.includes("sql server")) {
            return "MSSQL";
        }
        if (normalizedDriver.includes("mysql") || normalizedDriver.includes("maria")) {
            return "MySQL";
        }
        if (normalizedDriver.includes("postgres") || normalizedDriver === "pg") {
            return "PGSQL";
        }
        throw new Error(`SQLTools driver "${driver}" is not supported.`);
    }

    private static getConnectionId(connection: SqlToolsConnection): string {
        if (connection.id) {
            return connection.id;
        }

        const parts = connection.connectString
            ? [connection.name, connection.driver, connection.connectString]
            : [connection.name, connection.driver, connection.server, undefined];

        return parts
            .join("|")
            .replace(/\./g, ":")
            .replace(/\//g, "\\");
    }
}