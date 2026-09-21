/**
 * Tests for the folder lookup the bulk update pairs its files with
 * (src/util/folderList.ts). Loaded through the obsidian-stubbed jiti instance
 * (see tests/testFakeObsidian.mjs) because listAllFolders() walks real
 * `TFolder` instances and checks them with `instanceof`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jitiWithObsidianStub, TFolder } from './testFakeObsidian.mjs';

const { listAllFolders, findFoldersByName } = await jitiWithObsidianStub.import('../src/util/folderList.ts');

/** A vault whose folder tree is exactly `paths` (all parents must be listed). */
function fakeApp(paths) {
	const root = new TFolder('/');
	const byPath = new Map([['', root]]);
	for (const path of [...paths].sort()) {
		const folder = new TFolder(path);
		byPath.set(path, folder);
		const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
		byPath.get(parentPath).children.push(folder);
	}
	return { vault: { getRoot: () => root } };
}

test('listAllFolders returns every folder but the root, in path order', () => {
	const app = fakeApp(['Kongresse', 'Kongresse/2026', 'Archiv']);
	assert.deepEqual(listAllFolders(app).map(f => f.path), ['Archiv', 'Kongresse', 'Kongresse/2026']);
});

test('findFoldersByName matches a folder nested anywhere, not just at the vault root', () => {
	// The reason the bulk update matches on the NAME rather than the path: a
	// vault that keeps its conventions in a subfolder would otherwise never be
	// paired with the file it was imported from.
	const app = fakeApp(['Kongresse', 'Kongresse/2026 Regionaler Kongress']);
	assert.deepEqual(
		findFoldersByName(app, '2026 Regionaler Kongress').map(f => f.path),
		['Kongresse/2026 Regionaler Kongress'],
	);
});

test('findFoldersByName reports every folder of that name, leaving the choice to the caller', () => {
	// Same convention imported twice under different parents is a real
	// possibility; guessing one would write into the wrong one silently.
	const app = fakeApp(['Archiv', 'Archiv/Kongress', 'Aktuell', 'Aktuell/Kongress']);
	assert.deepEqual(
		findFoldersByName(app, 'Kongress').map(f => f.path),
		['Aktuell/Kongress', 'Archiv/Kongress'],
	);
});

test('findFoldersByName returns nothing when no folder carries that name', () => {
	const app = fakeApp(['Kongresse']);
	assert.deepEqual(findFoldersByName(app, 'Kongresse/2026'), []);
	assert.deepEqual(findFoldersByName(app, 'Nicht vorhanden'), []);
});
