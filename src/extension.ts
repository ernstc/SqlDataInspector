import { Database } from './models/database.model';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { VisualizationController, VisualizationPanelController } from './controllers/visualization.controller';

export const activate = (context: vscode.ExtensionContext) => {

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('sql-data-inspector.inspect-data', async (context: azdata.ObjectExplorerContext) => {
        if (context.connectionProfile != undefined) {

            let connectionId = context.connectionProfile?.id

            let activeConnections = await azdata.connection.getActiveConnections();
            if (!activeConnections.some(c => c.connectionId == connectionId)) {
                await azdata.connection.connect(context.connectionProfile!, undefined, false);
                activeConnections = await azdata.connection.getActiveConnections();
            }

            const connection = activeConnections.filter(c => c.connectionId == connectionId)[0];
            const databaseName = connection.options.database;

            // Create and show a new webview
            const panel = vscode.window.createWebviewPanel(
                'sql-data-inspector', // Identifies the type of the webview. Used internally
                'Data Inspector - ' + databaseName, // Title of the panel displayed to the user
                vscode.ViewColumn.One, // Editor column to show the new webview panel in.
                {
                    enableScripts: true
                } // Webview options. More on these later.
            );

            // And set its HTML content
            await VisualizationPanelController(panel.webview, connection);
        }
    }));

    return VisualizationController(context);
}

export const deactivate = () => { };
