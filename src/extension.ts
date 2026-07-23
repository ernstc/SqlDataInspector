import * as vscode from 'vscode';
import { ConnectionContext } from './connection-context';
import { VisualizationController } from './controllers/visualization.controller';
import { FQName } from './FQName';
import { DbRepository } from './repositories/db.repository';

export const activate = (context: vscode.ExtensionContext) => {
    ConnectionContext.initialize(context);
    context.subscriptions.push(
        vscode.commands.registerCommand('sql-data-inspector.inspect-data', () => loadVisualization(false)),
        vscode.commands.registerCommand('sql-data-inspector.inspect-data-editor', () => loadVisualization(true))
    );
};

export const deactivate = () => { };

const loadVisualization = async (useEditorSelection: boolean) => {
    try {
        const selectedText = useEditorSelection
            ? ConnectionContext.getSelectedEditorText()
            : undefined;
        const fqname = new FQName(selectedText);
        const connectionContext = await ConnectionContext.select(fqname);
        if (!connectionContext) {
            return;
        }

        DbRepository.create(connectionContext);

        const panel = vscode.window.createWebviewPanel(
            'sql-data-inspector',
            `Data Inspector - ${fqname.databaseName ?? connectionContext.connectionSelector}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        await VisualizationController(panel.webview, connectionContext);
    }
    catch (error) {
        vscode.window.showErrorMessage((error as Error).message);
    }
};