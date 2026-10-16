import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConnectionContext, MssqlConnectionInfo } from '../../connection-context';
import { FQName } from '../../FQName';

describe('MSSQL connection sharing', () => {
    const extensionId = 'ErnestoCianciotta.sql-data-inspector-mssql';
    const profile: MssqlConnectionInfo = {
        id: 'saved-profile-id',
        server: 'localhost',
        database: 'master',
        profileName: 'Local SQL Server'
    };
    let sharing: {
        connect: jasmine.Spy;
        disconnect: jasmine.Spy;
        executeSimpleQuery: jasmine.Spy;
    };
    let getExtension: jasmine.Spy;
    let configuration: vscode.WorkspaceConfiguration;

    beforeEach(() => {
        sharing = {
            connect: jasmine.createSpy('connect').and.resolveTo('shared-connection-uri'),
            disconnect: jasmine.createSpy('disconnect'),
            executeSimpleQuery: jasmine.createSpy('executeSimpleQuery').and.resolveTo({
                columnInfo: [{ columnName: 'Name' }, { columnName: 'Value' }],
                rows: [[{ displayValue: 'example', isNull: false }, { displayValue: 'NULL', isNull: true }]]
            })
        };
        const api = { connectionSharing: sharing };
        const extension: vscode.Extension<typeof api> = {
            id: 'ms-mssql.mssql',
            extensionUri: vscode.Uri.file('/mssql'),
            extensionPath: '/mssql',
            isActive: true,
            packageJSON: {},
            extensionKind: vscode.ExtensionKind.Workspace,
            exports: api,
            activate: async () => api
        };
        getExtension = spyOn(vscode.extensions, 'getExtension').and.returnValue(extension);
        configuration = { ...vscode.workspace.getConfiguration('mssql') };
        spyOn(vscode.workspace, 'getConfiguration').and.returnValue(configuration);
    });

    it('connects by saved profile ID using the caller identity and selected database', async () => {
        const selected = ConnectionContext.getObjectExplorerConnectionProfile({
            connectionProfile: profile,
            metadata: { name: 'AdventureWorks', metadataTypeName: 'Database' }
        });
        const picker = spyOn(vscode.window, 'showQuickPick');
        const context = await ConnectionContext.select(new FQName(), extensionId, selected);

        expect(sharing.connect).toHaveBeenCalledOnceWith(extensionId, profile.id, 'AdventureWorks');
        expect(picker).not.toHaveBeenCalled();
        assert.equal(context?.connectionId, 'shared-connection-uri');
        assert.equal(context?.fqname.databaseName, 'AdventureWorks');
        assert.equal(context?.fqname.serverName, 'localhost');
        assert.equal(profile.database, 'master');
    });

    it('inherits the database from a parent Object Explorer node', () => {
        const selected = ConnectionContext.getObjectExplorerConnectionProfile({
            connectionProfile: profile,
            metadata: { name: 'Tables', metadataTypeName: 'Folder' },
            parentNode: { metadata: { name: 'AdventureWorks', metadataTypeName: 'Database' } }
        });
        assert.equal(selected?.database, 'AdventureWorks');
        assert.equal(selected?.id, profile.id);
    });

    it('connects to the database in a fully qualified editor selection', async () => {
        const context = await ConnectionContext.select(new FQName('[Reporting].[dbo].[Events]'), extensionId, profile);

        expect(sharing.connect).toHaveBeenCalledOnceWith(extensionId, profile.id, 'Reporting');
        assert.equal(context?.connectionProfile.database, 'Reporting');
        assert.equal(context?.fqname.tableName, 'Events');
        assert.equal(profile.database, 'master');
    });

    it('offers user and workspace profiles without exposing credentials', async () => {
        const workspaceProfile = { ...profile, id: 'workspace-id', database: 'Reporting' };
        spyOn(configuration, 'inspect').and.returnValue({
            key: 'mssql.connections',
            globalValue: [{ ...profile, password: 'not-for-display' }],
            workspaceValue: [workspaceProfile, {}, null]
        });
        const workspaceChoice = {
            label: 'Local SQL Server',
            description: 'Reporting',
            detail: 'localhost',
            connection: workspaceProfile
        };
        const picker = spyOn(vscode.window, 'showQuickPick').and.resolveTo(workspaceChoice);

        const context = await ConnectionContext.select(new FQName('dbo.Events'), extensionId);

        expect(picker).toHaveBeenCalled();
        const choices = await picker.calls.mostRecent().args[0];
        assert.equal(choices.length, 2);
        const visibleItems = choices.map(item => {
            if (typeof item === 'string') {
                throw new Error('Expected a connection picker item.');
            }
            return { label: item.label, description: item.description, detail: item.detail };
        });
        assert.deepStrictEqual(visibleItems[1], {
            label: profile.profileName, description: 'Reporting', detail: 'localhost'
        });
        assert.ok(!JSON.stringify(visibleItems).includes('not-for-display'));
        expect(sharing.connect).toHaveBeenCalledOnceWith(extensionId, 'workspace-id', 'Reporting');
        assert.equal(context?.fqname.tableName, 'Events');
    });

    it('treats cancelling the connection picker as cancellation', async () => {
        spyOn(configuration, 'inspect').and.returnValue({ key: 'mssql.connections', globalValue: [profile] });
        spyOn(vscode.window, 'showQuickPick').and.resolveTo(undefined);

        assert.equal(await ConnectionContext.select(new FQName(), extensionId), undefined);
        expect(sharing.connect).not.toHaveBeenCalled();
    });

    it('reports when no saved profiles are available', async () => {
        spyOn(configuration, 'inspect').and.returnValue({ key: 'mssql.connections', globalValue: [{}] });

        await assert.rejects(ConnectionContext.select(new FQName(), extensionId), /No saved MSSQL connections/);
        expect(sharing.connect).not.toHaveBeenCalled();
    });

    it('reports an unsaved Object Explorer connection instead of picking a different database', async () => {
        await assert.rejects(ConnectionContext.select(new FQName(), extensionId, {
            server: 'localhost', database: 'AdventureWorks'
        }), /no saved profile ID/);
        expect(sharing.connect).not.toHaveBeenCalled();
    });

    it('reports when MSSQL is not installed', async () => {
        getExtension.and.returnValue(undefined);
        await assert.rejects(ConnectionContext.select(new FQName(), extensionId, profile), /not installed/);
    });

    it('reports incompatible MSSQL exports', async () => {
        getExtension.and.returnValue({ activate: async () => ({}) });
        await assert.rejects(ConnectionContext.select(new FQName(), extensionId, profile), /connection-sharing API is unavailable/);
    });

    it('propagates activation errors', async () => {
        getExtension.and.returnValue({ activate: async () => { throw new Error('Activation failed'); } });
        await assert.rejects(ConnectionContext.select(new FQName(), extensionId, profile), /Activation failed/);
    });

    it('propagates connection-sharing permission errors', async () => {
        sharing.connect.and.rejectWith(new Error('Connection sharing permission denied'));
        await assert.rejects(ConnectionContext.select(new FQName(), extensionId, profile), /permission denied/);
    });

    it('rejects an empty connection URI', async () => {
        sharing.connect.and.resolveTo(undefined);
        await assert.rejects(ConnectionContext.select(new FQName(), extensionId, profile), /did not establish a connection/);
    });

    it('executes queries using the shared URI and preserves null values', async () => {
        const context = await ConnectionContext.select(new FQName(), extensionId, profile);
        assert.ok(context);

        assert.deepStrictEqual(await context.runQueryAndReturn('SELECT Name, Value FROM dbo.Events'), [
            { Name: 'example', Value: null }
        ]);
        expect(sharing.executeSimpleQuery).toHaveBeenCalledOnceWith(
            'shared-connection-uri', 'SELECT Name, Value FROM dbo.Events'
        );
    });

    it('surfaces query errors', async () => {
        sharing.executeSimpleQuery.and.rejectWith(new Error('Query failed'));
        const context = await ConnectionContext.select(new FQName(), extensionId, profile);
        assert.ok(context);

        await assert.rejects(context.runQueryAndReturn('SELECT 1'), /MSSQL query execution failed.*Query failed/);
    });

    it('releases only the inspector shared connection', async () => {
        const context = await ConnectionContext.select(new FQName(), extensionId, profile);
        assert.ok(context);
        context.dispose();
        expect(sharing.disconnect).toHaveBeenCalledOnceWith('shared-connection-uri');
    });
});
