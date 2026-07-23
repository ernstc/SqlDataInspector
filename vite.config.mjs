import { builtinModules } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';

const nodeBuiltins = new Set([
    ...builtinModules,
    ...builtinModules.map(moduleName => `node:${moduleName}`)
]);

export default defineConfig(({ mode }) => ({
    build: {
        target: 'node20',
        outDir: 'dist',
        emptyOutDir: false,
        minify: mode === 'production',
        sourcemap: mode === 'production' ? 'hidden' : true,
        lib: {
            entry: path.resolve('src/extension.ts'),
            formats: ['cjs'],
            fileName: () => 'extension.js'
        },
        rollupOptions: {
            external: moduleName => moduleName === 'vscode' || nodeBuiltins.has(moduleName),
            output: {
                exports: 'named'
            }
        }
    }
}));