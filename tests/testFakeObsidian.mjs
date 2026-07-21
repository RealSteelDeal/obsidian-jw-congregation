/**
 * Test-only harness that makes `src/main.ts` importable and runnable outside
 * a real Obsidian host — see `tests/obsidianStub.mjs` for what's stubbed and
 * why. Uses a SEPARATE jiti instance from `tests/_setup.mjs`'s shared one
 * (via jiti's `alias` option) so this aliasing never affects any other test
 * file; every module `main.ts` imports (settings.ts, every ui/*.ts modal)
 * must be loaded through THIS instance too, or it would resolve the real,
 * unstubbed `obsidian` package and throw.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';

const ROOT = path.resolve(import.meta.dirname, '..');

export const jitiWithObsidianStub = createJiti(import.meta.url, {
	alias: {
		obsidian: path.resolve(ROOT, 'tests/obsidianStub.mjs'),
		// main.ts's `import sqlWasmBinary from 'sql.js/dist/sql-wasm.wasm'` only
		// resolves at bundle time via esbuild's "binary" loader — jiti has no
		// equivalent, so it's aliased to an empty-buffer stub. Safe for these
		// tests: they only ever exercise the RTF import path (JwpubParser's
		// sql.js initialization never runs unless a real .jwpub is decrypted).
		'sql.js/dist/sql-wasm.wasm': path.resolve(ROOT, 'tests/fakeWasm.mjs'),
	},
});

export const { TFile, TFolder, Notice } = await import(pathToFileURL(path.resolve(ROOT, 'tests/obsidianStub.mjs')));

/**
 * An in-memory vault + fileManager + workspace, just enough of the real
 * Obsidian `App` surface for `JwCongregationPlugin.importFile()`/`updateFile()`
 * to run against: path-keyed note/attachment maps, TFile/TFolder identity
 * (so the plugin's own `instanceof TFile`/`instanceof TFolder` checks behave
 * correctly), and a `trashFile()` that actually removes the entry so rollback
 * behavior is observable.
 */
export function createFakeApp() {
	const notes = new Map(); // path -> string content
	const binaries = new Map(); // path -> ArrayBuffer/Uint8Array
	const folders = new Set(['']); // '' = vault root, always exists
	const trashed = [];
	let failCreateOnCall = null; // 1-based call index at which `create()` throws

	const vault = {
		getAbstractFileByPath(p) {
			if (notes.has(p) || binaries.has(p)) return new TFile(p);
			if (folders.has(p)) return new TFolder(p);
			return null;
		},
		async create(p, content) {
			if (failCreateOnCall !== null && --failCreateOnCall === 0) {
				throw new Error('simulated write failure');
			}
			notes.set(p, content);
			return new TFile(p);
		},
		async modify(file, content) { notes.set(file.path, content); },
		async read(file) { return notes.get(file.path); },
		async createBinary(p, data) { binaries.set(p, data); return new TFile(p); },
		async modifyBinary(file, data) { binaries.set(file.path, data); },
		async createFolder(p) { folders.add(p); },
		adapter: {
			async exists() { return false; },
			async writeBinary() {},
			async readBinary() {},
			async remove() {},
		},
	};

	const fileManager = {
		async trashFile(file) {
			trashed.push(file.path);
			notes.delete(file.path);
			binaries.delete(file.path);
		},
	};

	const workspace = {
		getLeaf() { return { openFile: async () => {} }; },
	};

	return {
		app: { vault, fileManager, workspace },
		notes,
		binaries,
		folders,
		trashed,
		/** Makes the Nth call to vault.create() throw, to exercise the rollback path. */
		failCreateOnCall(n) { failCreateOnCall = n; },
	};
}
