import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { ConnectionContext } from '../../connection-context';

describe('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	it('Sample test', () => {
		assert.equal(-1, [1, 2, 3].indexOf(5));
		assert.equal(-1, [1, 2, 3].indexOf(0));
	});

	it('Uses the database selected in MSSQL Object Explorer', () => {
		const connectionProfile = {
			server: 'localhost',
			database: 'master',
			profileName: 'Local SQL Server'
		};
		const selectedProfile = ConnectionContext.getObjectExplorerConnectionProfile({
			connectionProfile,
			metadata: {
				name: 'AdventureWorks',
				metadataTypeName: 'Database'
			}
		});

		assert.deepStrictEqual(selectedProfile, {
			...connectionProfile,
			database: 'AdventureWorks'
		});
		assert.equal(connectionProfile.database, 'master');
	});

	it('Falls back when the Object Explorer node is incompatible', () => {
		const selectedProfile = ConnectionContext.getObjectExplorerConnectionProfile({
			metadata: {
				name: 'AdventureWorks',
				metadataTypeName: 'Database'
			}
		});

		assert.equal(selectedProfile, undefined);
	});
});
