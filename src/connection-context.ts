import { IDbRepository } from './repositories/db.repository';
import * as vscode from "vscode";
import * as azdata from "azdata";
import { FQName } from "./FQName";

/*
    Retrieve the connectiona and context from the context of the request:
    - FQName: Server, Database, Schema and Table
    - Connection to the database
*/

export class ConnectionContext {

    public connection: azdata.connection.Connection;
    public connectionId: string;
    public fqname: FQName;
    public repository?: IDbRepository;

    public constructor(fqname: FQName, connection: azdata.connection.Connection) {
        this.fqname = fqname;
        this.connection = connection;
        this.connectionId = connection.connectionId;
    }

    // static factory method for Explorer context
    public static async ExplorerContext(iConnProfile: azdata.IConnectionProfile, fqname: FQName) {
        let activeConnections = await azdata.connection.getActiveConnections();
        if (!activeConnections.some(c => c.connectionId === iConnProfile.id)) {
            await azdata.connection.connect(iConnProfile!, false, false);
            activeConnections = await azdata.connection.getActiveConnections();
        }

        let connection = await this.getConnection(iConnProfile.id, fqname.databaseName);
        return new this(fqname, connection);
    }

    // static factory method for Editor context
    public static async EditerContext(connProfile: azdata.connection.ConnectionProfile, fqname: FQName) {
        let connection = await this.getConnection(connProfile.connectionId, fqname.databaseName);
        return new this(fqname, connection);
    }

    public static async getConnection(connectionId: string, databaseName?: string) {
        let activeConnections = await azdata.connection.getActiveConnections();
        //const iConnProfile = { ...connectionProfile, providerName: connectionProfile.providerId, id: '' };

        let connection: azdata.connection.Connection | undefined = activeConnections.filter(c => c.connectionId === connectionId)[0];

        if (databaseName !== undefined && connection.options.database !== databaseName) {
            connection = await this.changeDatabase(connection, databaseName);
        }

        if (connection === undefined) {
            throw new Error("No active connection");
        }
        return connection;
    }

    public static async changeDatabase(connection: azdata.connection.Connection, databaseName: string) {
        let connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
        let connectionProvider: azdata.ConnectionProvider = azdata.dataprotocol.getProvider(connection.providerName, azdata.DataProviderType.ConnectionProvider);
        let databaseChanged = await connectionProvider.changeDatabase(connectionUri, databaseName);
        if (databaseChanged) {
            let activeConnections = await azdata.connection.getActiveConnections();
            return activeConnections.filter(c => c.connectionId === connection.connectionId)[0];
        }
    }

    public static getSelectedEditorText() {
        // Get the current editor
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) { //No active editor
            return;
        }
        // Retrieve selection or word under cursor.
        const textRange = !editor.selection.isEmpty
            ? editor.selection
            : editor.document.getWordRangeAtPosition(editor.selection.active);
        if (textRange === undefined) { //No selected text
            return;
        }
        return editor.document.getText(textRange);
    }

}


