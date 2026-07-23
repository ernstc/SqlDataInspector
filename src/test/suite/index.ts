import * as path from 'path';
import Jasmine = require('jasmine');

export async function run(): Promise<void> {
	const testsRoot = path.resolve(__dirname, '..');
	const jasmine = new Jasmine({ projectBaseDir: testsRoot });

	jasmine.exitOnCompletion = false;
	jasmine.loadConfig({
		spec_dir: '.',
		spec_files: ['**/**.test.js'],
		helpers: [],
		jsLoader: 'require'
	});
	jasmine.env.configure({ random: false });
	jasmine.configureDefaultReporter({ showColors: true });

	const result = await jasmine.execute();
	if (result.overallStatus !== 'passed') {
		throw new Error(`Jasmine tests ${result.overallStatus}.`);
	}
}
