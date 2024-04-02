import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { VisualizationController } from './controllers/visualization.controller';
import { ConnectionContext } from './connection-context';
import { FQName } from './FQName';
import { DbRepository } from './repositories/db.repository';


export const activate = (context: vscode.ExtensionContext) => {

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand(
        'sql-data-inspector.inspect-data',
        loadVisualizationFromExplorer)
    );
    context.subscriptions.push(vscode.commands.registerCommand(
        'sql-data-inspector.inspect-data-editor',
        loadVisualizationFromEditor)
    );
};


export const deactivate = () => { };


const loadVisualizationFromExplorer = async (context: azdata.ObjectExplorerContext) => {
    // Build and set the HTML content
    try {

        // Get the IconnectionProfile
        let iConnProfile: azdata.IConnectionProfile | undefined = context.connectionProfile;
        if (iConnProfile === undefined) {
            throw new Error("No active connectionProfile");
        }

        // Get the fqn from the selected database in the explorer
        let fqname: FQName = {
            serverName: iConnProfile?.serverName,
            databaseName: iConnProfile?.databaseName
        };

        // Get the active connection information
        let connectionContext = await ConnectionContext.ExplorerContext(iConnProfile, fqname);

        // Inizialize the DbRepository
        DbRepository.create(connectionContext);

        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'sql-data-inspector', // Identifies the type of the webview. Used internally
            'Data Inspector - ' + fqname.databaseName, // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true
            } // Webview options. More on these later.
        );

        // And set its HTML content
        await VisualizationController(
            panel.webview,
            connectionContext
        );
    }
    catch (e) {
        vscode.window.showErrorMessage(
            (<Error>e).message
        );
    }
};


const loadVisualizationFromEditor = async (context: azdata.ObjectExplorerContext) => {
    // Build and set the HTML content
    try {

        // Get the connectionProfile
        let connProfile = await azdata.connection.getCurrentConnection();
        if (connProfile === undefined) {
            throw new Error("No active connectionProfile");
        }

        // Get fqname from the selected text
        let selectedText = ConnectionContext.getSelectedEditorText();
        let fqname = new FQName(selectedText);

        if (fqname.serverName === undefined) {
            fqname.serverName = connProfile.serverName;
        }

        if (fqname.databaseName === undefined) {
            fqname.databaseName = connProfile.databaseName;
        }

        // Get the active connection information
        let connectionContext = await ConnectionContext.EditerContext(connProfile, fqname);

        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'sql-data-inspector', // Identifies the type of the webview. Used internally
            'Data Inspector - ' + fqname.databaseName, // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true
            } // Webview options. More on these later.
        );

        // And set its HTML content
        await VisualizationController(
            panel.webview,
            connectionContext
        );
    }
    catch (e) {
        vscode.window.showErrorMessage(
            (<Error>e).message
        );
    }
};

