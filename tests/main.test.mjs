/**
 * Unit tests for JwCongregationPlugin's core orchestration (main.ts) —
 * previously untested entirely, since there was no way to import a file that
 * depends on the real `obsidian` package. `tests/obsidianStub.mjs` +
 * `tests/testFakeObsidian.mjs` provide a minimal stand-in (see their own doc
 * comments) that's just enough to construct a real `JwCongregationPlugin`
 * instance and run `importFile()`/`updateFile()` against an in-memory vault.
 *
 * These tests always import a small, hand-written RTF fixture (never real
 * congress program text — see the project's copyright-safety convention),
 * routed through the REAL `RtfParser`/`NoteBuilder`/`noteMerge`/
 * `legacyFieldPatch` pipeline exactly as production code does — only the
 * Obsidian host itself is faked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jitiWithObsidianStub, Notice, createFakeApp } from './testFakeObsidian.mjs';

const { default: JwCongregationPlugin } = await jitiWithObsidianStub.import('../src/main.ts');
const { DEFAULT_SETTINGS } = await jitiWithObsidianStub.import('../src/settings.ts');

function hyperlinkField(url, label) {
	return `{\\field{\\*\\fldinst {HYPERLINK "${url}" }}{\\fldrslt{\\ul ${label}}}}`;
}

function rtfDoc(body) {
	return '{\\rtf1\\ansi\\uc1{\\*\\generator WTS5;}' + body + '}';
}

/** A single-day, single-talk RTF fixture (→ CA-copgm, no day subfolder) whose
 *  only varying part between "versions" is the talk's time — used to exercise
 *  the marker-merge and legacy-field-patch paths on a real, uniquely-labelled field. */
function makeRtf(time) {
	const bibleLink = hyperlinkField('https://example.invalid/finder?bible=40005003', 'Beispielbuch 5 Vers 3');
	const rtf = rtfDoc(
		'\\pard Freitag\\par' +
		'\\pard Vormittag\\par' +
		`\\pard ${time} Vortrag: Beispieltitel (${bibleLink})\\par`,
	);
	return Buffer.from(rtf, 'latin1');
}

function makePlugin(app) {
	const plugin = new JwCongregationPlugin(app, { dir: 'jw-congregation-program' });
	plugin.settings = { ...DEFAULT_SETTINGS };
	plugin.sqlWasmBinary = new Uint8Array(0); // never touched on the RTF import path
	return plugin;
}

function dirname(p) {
	const i = p.lastIndexOf('/');
	return i === -1 ? '' : p.slice(0, i);
}

function findItemNotePath(notes) {
	return [...notes.keys()].find(p => !p.endsWith('Übersicht.md') && !p.endsWith('Wiederholung.md'));
}

test('importFile() creates an overview, one item note and a review note in a fresh vault', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	Notice.instances.length = 0;

	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const paths = [...fake.notes.keys()];
	assert.equal(paths.length, 3);
	assert.ok(paths.some(p => p.endsWith('00. Übersicht.md')));
	assert.ok(paths.some(p => p.endsWith('Wiederholung.md')));
	assert.equal(fake.trashed.length, 0);
});

test('importFile() re-run into the same folder never overwrites an existing item note, but refreshes the regenerate-flagged overview', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const overviewPath = [...fake.notes.keys()].find(p => p.endsWith('00. Übersicht.md'));
	fake.notes.set(itemPath, 'MEINE EIGENEN NOTIZEN ZUM VORTRAG.');
	fake.notes.set(overviewPath, 'VERALTETER ÜBERSICHTS-INHALT');

	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	assert.equal(fake.notes.get(itemPath), 'MEINE EIGENEN NOTIZEN ZUM VORTRAG.'); // untouched, never overwritten
	assert.notEqual(fake.notes.get(overviewPath), 'VERALTETER ÜBERSICHTS-INHALT'); // regenerated
	assert.match(fake.notes.get(overviewPath), /Beispieltitel/);
});

test('importFile() rolls back files created so far when a later write fails', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	Notice.instances.length = 0;
	// 1st create() call succeeds (overview), 2nd (the item note) throws.
	fake.failCreateOnCall(2);

	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	assert.equal(fake.notes.size, 0); // the overview created before the failure was rolled back
	assert.equal(fake.trashed.length, 1);
	assert.ok(Notice.instances.some(n => /zurückgerollt/.test(n.message)));
});

test('updateFile() reports the folder-not-found notice and writes nothing when the target folder does not exist', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	Notice.instances.length = 0;

	await plugin.updateFile('Test.rtf', makeRtf('9 Uhr 40'), 'Does/Not/Exist');

	assert.equal(fake.notes.size, 0);
	assert.equal(Notice.instances.length, 1);
	assert.match(Notice.instances[0].message, /nicht gefunden/);
});

test('updateFile() merges a corrected marker-wrapped field while preserving text the user added elsewhere in the same note', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const congressPath = dirname(itemPath);
	const withUserEdits = fake.notes.get(itemPath)
		.replace('**Redner:**', '**Redner:** Bruder Schmidt')
		+ '\nMeine persönliche Notiz zu diesem Vortrag.\n';
	fake.notes.set(itemPath, withUserEdits);

	Notice.instances.length = 0;
	await plugin.updateFile('Test.rtf', makeRtf('9 Uhr 50'), congressPath);

	const merged = fake.notes.get(itemPath);
	assert.match(merged, /\*\*Uhrzeit:\*\* 9:50/); // corrected field landed
	assert.match(merged, /Bruder Schmidt/); // user's speaker entry survived
	assert.match(merged, /Meine persönliche Notiz zu diesem Vortrag\./); // user's own text survived
	assert.doesNotMatch(merged, /9:40/); // old value is gone, not just appended
});

test('updateFile() leaves a marker-free (pre-1.9.0-style) note completely untouched but reports it as a legacy candidate via a separate notice', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const congressPath = dirname(itemPath);
	// Simulate a note from before the marker mechanism existed: strip every
	// %%jw:...%%/%%/jw:...%% line, keeping all visible content as-is.
	const legacyContent = fake.notes.get(itemPath).replace(/^%%\/?jw:[^%]+%%\n?/gm, '');
	fake.notes.set(itemPath, legacyContent);

	Notice.instances.length = 0;
	await plugin.updateFile('Test.rtf', makeRtf('9 Uhr 50'), congressPath);

	// Never written to directly — only offered for review, never auto-applied.
	assert.equal(fake.notes.get(itemPath), legacyContent);
	assert.match(legacyContent, /9:40/);

	const legacyNotice = Notice.instances.find(n => /möglichen Korrekturen gefunden/.test(n.message));
	assert.ok(legacyNotice, 'expected a distinct "legacy corrections found" notice');
	assert.match(legacyNotice.message, /^1 /); // exactly one candidate note
});
