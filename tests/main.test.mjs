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
	// <span class="jw-marker" data-jw-start/end="…"></span> line, keeping all
	// visible content as-is.
	const legacyContent = fake.notes.get(itemPath).replace(/^<span class="jw-marker" data-jw-(?:start|end)="[^"]+"><\/span>\n?/gm, '');
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

// ── Bulk update (updateFolders) ────────────────────────────────────────────
// updateFile() itself is a one-job call into updateFolders(), so the tests
// above already cover the single-folder notices; these cover only what the
// bulk path adds on top: several conventions in one run, and what happens
// when one of them cannot be updated.

const { SourceRouter } = await jitiWithObsidianStub.import('../src/parser/SourceRouter.ts');

async function parseCongress(rtf) {
	const { congress } = await new SourceRouter(new Uint8Array(0)).route('Test.rtf', rtf);
	return congress;
}

/** The item note of the congress folder directly under `parent` ('' = root). */
function itemNoteUnder(notes, parent) {
	const prefix = parent === '' ? '' : `${parent}/`;
	return [...notes.keys()].find(p =>
		p.startsWith(prefix)
		&& (parent !== '' || !p.startsWith('Archiv/'))
		&& !p.endsWith('Übersicht.md') && !p.endsWith('Wiederholung.md'));
}

test('updateFolders() reconciles several conventions in one run and sums them into a single result notice', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('A.rtf', makeRtf('9 Uhr 40'), '');
	await plugin.importFile('B.rtf', makeRtf('9 Uhr 40'), 'Archiv');

	const itemA = itemNoteUnder(fake.notes, '');
	const itemB = itemNoteUnder(fake.notes, 'Archiv');
	assert.ok(itemA && itemB, 'expected one item note per imported convention');

	const congress = await parseCongress(makeRtf('9 Uhr 50'));
	Notice.instances.length = 0;
	await plugin.updateFolders([
		{ label: 'A.rtf', folder: dirname(itemA), congress },
		{ label: 'B.rtf', folder: dirname(itemB), congress },
	]);

	assert.match(fake.notes.get(itemA), /\*\*Uhrzeit:\*\* 9:50/);
	assert.match(fake.notes.get(itemB), /\*\*Uhrzeit:\*\* 9:50/);

	const summaries = Notice.instances.filter(n => /Kongress\(e\) aktualisiert/.test(n.message));
	assert.equal(summaries.length, 1, 'one summary for the whole run, not one per folder');
	assert.match(summaries[0].message, /^2 Kongress\(e\)/);
	assert.doesNotMatch(summaries[0].message, /Fehlgeschlagen/);
});

test('updateFolders() finishes the other conventions when one of them cannot be updated, and names the failure', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('A.rtf', makeRtf('9 Uhr 40'), '');

	const itemA = itemNoteUnder(fake.notes, '');
	const congress = await parseCongress(makeRtf('9 Uhr 50'));
	Notice.instances.length = 0;
	// Second job points at a folder that was deleted (or renamed) since the
	// files were picked — the first job must still be carried out in full.
	await plugin.updateFolders([
		{ label: 'A.rtf', folder: dirname(itemA), congress },
		{ label: 'Weg.rtf', folder: 'Gibt/Es/Nicht', congress },
	]);

	assert.match(fake.notes.get(itemA), /\*\*Uhrzeit:\*\* 9:50/);
	assert.ok(Notice.instances.some(n => /nicht gefunden/.test(n.message)));

	const summary = Notice.instances.find(n => /Kongress\(e\) aktualisiert/.test(n.message));
	assert.ok(summary);
	assert.match(summary.message, /^1 Kongress\(e\)/); // only the one that worked is counted
	assert.match(summary.message, /Fehlgeschlagen: Weg\.rtf/);
});

test('updateFolders() with a single job reports exactly the notices the single-folder update always did', async () => {
	// updateFile() delegates here, so the bulk summary must NOT appear for a
	// run of one — that wording would be new text in an unchanged workflow.
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const congress = await parseCongress(makeRtf('9 Uhr 50'));
	Notice.instances.length = 0;
	await plugin.updateFolders([{ label: 'Test.rtf', folder: dirname(itemPath), congress }]);

	assert.ok(Notice.instances.some(n => /^Aktualisierung abgeschlossen:/.test(n.message)));
	assert.ok(!Notice.instances.some(n => /Kongress\(e\) aktualisiert/.test(n.message)));
});

test('updateFolders() does nothing at all when given no jobs', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	Notice.instances.length = 0;

	await plugin.updateFolders([]);

	assert.equal(fake.notes.size, 0);
	assert.equal(Notice.instances.length, 0);
});

// ── Update preview (previewFolders) ───────────────────────────────────────

test('previewFolders() reports the change it would make and writes absolutely nothing', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const before = new Map(fake.notes);
	const congress = await parseCongress(makeRtf('9 Uhr 50'));
	Notice.instances.length = 0;

	const previews = await plugin.previewFolders([{ label: 'Test.rtf', folder: dirname(itemPath), congress }]);

	// Nothing written, nothing trashed, not even a notice.
	assert.deepEqual([...fake.notes.entries()], [...before.entries()]);
	assert.equal(fake.trashed.length, 0);
	assert.equal(Notice.instances.length, 0);

	assert.equal(previews.length, 1);
	const planned = previews[0].plan.notes.find(n => n.path === itemPath);
	assert.equal(planned.kind, 'merge');
	assert.equal(planned.changes.length, 1);
	assert.match(planned.changes[0].before, /9:40/);
	assert.match(planned.changes[0].after, /9:50/);
});

test('previewFolders() reports no changes for a folder that is already up to date', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const congress = await parseCongress(makeRtf('9 Uhr 40')); // same programme
	const previews = await plugin.previewFolders([{ label: 'Test.rtf', folder: dirname(itemPath), congress }]);

	const item = previews[0].plan.notes.find(n => n.path === itemPath);
	assert.equal(item.kind, 'unchanged');
	// The overview carries markers since 1.26.0, so an unchanged programme
	// leaves it genuinely untouched rather than rewritten with the same bytes.
	const overview = previews[0].plan.notes.find(n => n.path.endsWith('Übersicht.md'));
	assert.equal(overview.kind, 'unchanged');
});

test('previewFolders() marks a marker-free note as needing a re-import instead of planning a merge', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const legacy = fake.notes.get(itemPath).replace(/^<span class="jw-marker" data-jw-(?:start|end)="[^"]+"><\/span>\n?/gm, '');
	fake.notes.set(itemPath, legacy);

	const congress = await parseCongress(makeRtf('9 Uhr 50'));
	const previews = await plugin.previewFolders([{ label: 'Test.rtf', folder: dirname(itemPath), congress }]);

	const planned = previews[0].plan.notes.find(n => n.path === itemPath);
	assert.equal(planned.kind, 'needs-reimport');
	assert.ok(planned.legacy.length > 0, 'the legacy heuristic still finds its candidates');
	assert.equal(fake.notes.get(itemPath), legacy); // still untouched
});

test('previewFolders() reports a missing folder per convention instead of throwing', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	const congress = await parseCongress(makeRtf('9 Uhr 50'));

	const previews = await plugin.previewFolders([{ label: 'Weg.rtf', folder: 'Gibt/Es/Nicht', congress }]);

	assert.equal(previews[0].plan, null);
	assert.match(previews[0].error, /nicht gefunden/);
});

test('the preview and the update that follows it agree on what changes', async () => {
	// The property the whole feature rests on: what was shown is what happens.
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const congress = await parseCongress(makeRtf('9 Uhr 50'));
	const jobs = [{ label: 'Test.rtf', folder: dirname(itemPath), congress }];

	const previews = await plugin.previewFolders(jobs);
	const promised = new Map(
		previews[0].plan.notes.filter(n => n.kind === 'merge').map(n => [n.path, n.content]),
	);
	assert.ok(promised.size > 0);

	await plugin.updateFolders(jobs);

	for (const [path, content] of promised) {
		assert.equal(fake.notes.get(path), content, path);
	}
});

// ── Speaker names → wiki links ────────────────────────────────────────────

/** Writes `name` into the Speaker field of `path`, the way a user would. */
function setSpeaker(fake, path, name) {
	fake.notes.set(path, fake.notes.get(path).replace('**Redner:**', `**Redner:** ${name}`));
}

test('scanSpeakerNames() finds hand-typed names and ignores the empty label the plugin writes', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	// Untouched to begin with: NoteBuilder writes the label and nothing else.
	assert.deepEqual(await plugin.scanSpeakerNames(), []);

	setSpeaker(fake, itemPath, 'Br. Sieberer');
	const found = await plugin.scanSpeakerNames();
	assert.equal(found.length, 1);
	assert.equal(found[0].path, itemPath);
	assert.equal(found[0].text, 'Br. Sieberer');
});

test('applySpeakerLinks() links the name while leaving the visible wording and the rest of the note alone', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	setSpeaker(fake, itemPath, 'Br. Sieberer');
	fake.notes.set(itemPath, fake.notes.get(itemPath) + '\nMeine eigene Notiz.\n');
	const before = fake.notes.get(itemPath);

	const occurrences = await plugin.scanSpeakerNames();
	Notice.instances.length = 0;
	await plugin.applySpeakerLinks([
		{ group: { suggested: 'Hannes Sieberer', variants: ['Br. Sieberer'], occurrences, ambiguous: false },
			target: 'Hannes Sieberer' },
	]);

	const after = fake.notes.get(itemPath);
	assert.match(after, /\*\*Redner:\*\* \[\[Hannes Sieberer\|Br\. Sieberer\]\]/);
	assert.match(after, /Meine eigene Notiz\./);
	// Exactly one line differs — nothing else in the note was rewritten.
	const changedLines = after.split('\n').filter((line, i) => line !== before.split('\n')[i]);
	assert.equal(changedLines.length, 1);
	assert.match(Notice.instances.at(-1).message, /1 Rednernamen verlinkt/);
});

test('applySpeakerLinks() skips a line that changed since it was reviewed, rather than overwriting it', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	setSpeaker(fake, itemPath, 'Br. Sieberer');
	const occurrences = await plugin.scanSpeakerNames();

	// The user edits the very same line between reviewing and applying.
	fake.notes.set(itemPath, fake.notes.get(itemPath).replace('**Redner:** Br. Sieberer', '**Redner:** Jemand anders'));

	Notice.instances.length = 0;
	await plugin.applySpeakerLinks([
		{ group: { suggested: 'Hannes Sieberer', variants: ['Br. Sieberer'], occurrences, ambiguous: false },
			target: 'Hannes Sieberer' },
	]);

	// The Speaker line specifically is left as the user last wrote it. (The
	// note does contain other links — the back link to the day's overview.)
	assert.match(fake.notes.get(itemPath), /\*\*Redner:\*\* Jemand anders$/m);
	assert.match(Notice.instances.at(-1).message, /1 übersprungen/);
});

test('a note written with the link setting on carries the empty link, and the scan does not report it', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	plugin.settings.speakerLink = true;
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	assert.match(fake.notes.get(itemPath), /\*\*Redner:\*\* \[\[\]\]/);
	// An empty link is not a name; offering it for conversion would be noise.
	assert.deepEqual(await plugin.scanSpeakerNames(), []);
});

// ── Removing a scripture link at the cursor ───────────────────────────────

/** Just enough of Obsidian's Editor for removeScriptureLinkAtCursor(): one
 *  line of text and a caret in it. */
function fakeEditor(line, ch) {
	let text = line;
	let cursor = { line: 0, ch };
	return {
		getCursor: () => cursor,
		getLine: () => text,
		getValue: () => text,
		replaceRange(replacement) { text = replacement; },
		setCursor(pos) { cursor = pos; },
		get text() { return text; },
		get caret() { return cursor; },
	};
}

const PSALM_LINK = '[Psalm 1:1](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&bible=19001001&pub=nwtsty)';

test('removing a reference takes the whole link out and leaves the caret where it stood', async () => {
	const plugin = makePlugin(createFakeApp().app);
	const line = `Lesen wir ${PSALM_LINK} dazu.`;
	const editor = fakeEditor(line, line.indexOf('Psalm 1:1'));
	Notice.instances.length = 0;

	plugin.removeLinkAtCursor(editor);

	assert.equal(editor.text, 'Lesen wir dazu.');
	assert.equal(editor.caret.ch, 'Lesen wir '.length);
	assert.equal(Notice.instances.length, 0); // silent on success — the result is visible
});

test('removing a reference says so when the caret is not in one, instead of deleting something else', async () => {
	const plugin = makePlugin(createFakeApp().app);
	const editor = fakeEditor('Ein Satz ganz ohne Bibelstelle.', 4);
	Notice.instances.length = 0;

	plugin.removeLinkAtCursor(editor);

	assert.equal(editor.text, 'Ein Satz ganz ohne Bibelstelle.');
	assert.match(Notice.instances[0].message, /keine Verlinkung/);
});

test('removing a reference takes the one the caret is in, not the first on the line', async () => {
	const plugin = makePlugin(createFakeApp().app);
	const second = PSALM_LINK.replace('19001001', '19002002').replace('Psalm 1:1', 'Psalm 2:2');
	const line = `${PSALM_LINK} und ${second}`;
	const editor = fakeEditor(line, line.indexOf('Psalm 2:2'));

	plugin.removeLinkAtCursor(editor);

	assert.match(editor.text, /Psalm 1:1/);
	assert.doesNotMatch(editor.text, /Psalm 2:2/);
});

test('removing a reference works from anywhere on a line that holds only one', async () => {
	// What makes the command usable on a phone: the caret lands next to the
	// rendered link rather than inside it, and there is nothing to choose.
	const plugin = makePlugin(createFakeApp().app);
	const line = `Lesen wir ${PSALM_LINK} dazu.`;
	const editor = fakeEditor(line, 2); // caret at the very start of the line
	Notice.instances.length = 0;

	plugin.removeLinkAtCursor(editor);

	assert.equal(editor.text, 'Lesen wir dazu.');
	assert.equal(Notice.instances.length, 0);
});

test('removing a reference refuses to guess when the line holds two and the caret is in neither', async () => {
	const plugin = makePlugin(createFakeApp().app);
	const second = PSALM_LINK.replace('19001001', '19002002').replace('Psalm 1:1', 'Psalm 2:2');
	const line = `${PSALM_LINK} und ${second}`;
	const editor = fakeEditor(line, line.indexOf(' und ') + 2); // between the two
	Notice.instances.length = 0;

	plugin.removeLinkAtCursor(editor);

	assert.equal(editor.text, line); // untouched — the wrong guess deletes the wrong reference
	assert.match(Notice.instances[0].message, /keine Verlinkung/);
});

// ── A correction inside a generated block survives the next update ────────
// The point of the whole markBlockKept mechanism: without it, changing a
// derived field would look as though it worked and quietly revert.

test('a field corrected through the plugin is not undone by a later update', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const congressPath = dirname(itemPath);
	const lines = fake.notes.get(itemPath).split('\n');

	// Stand in for the suggestion/command: correct a derived line, then flag
	// its block exactly as they do.
	const timeLine = lines.findIndex(l => l.startsWith('**Uhrzeit:**'));
	lines[timeLine] = '**Uhrzeit:** 10:15';
	const { markBlockKept } = await jitiWithObsidianStub.import('../src/util/noteMerge.ts');
	fake.notes.set(itemPath, markBlockKept(lines, timeLine).join('\n'));

	// The programme still says 9:50 — the user's own value has to win.
	await plugin.updateFile('Test.rtf', makeRtf('9 Uhr 50'), congressPath);

	const after = fake.notes.get(itemPath);
	assert.match(after, /\*\*Uhrzeit:\*\* 10:15/);
	assert.doesNotMatch(after, /9:50/);
});

test('the preview does not promise a change to a field the user corrected', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const itemPath = findItemNotePath(fake.notes);
	const lines = fake.notes.get(itemPath).split('\n');
	const timeLine = lines.findIndex(l => l.startsWith('**Uhrzeit:**'));
	lines[timeLine] = '**Uhrzeit:** 10:15';
	const { markBlockKept } = await jitiWithObsidianStub.import('../src/util/noteMerge.ts');
	fake.notes.set(itemPath, markBlockKept(lines, timeLine).join('\n'));

	const congress = await parseCongress(makeRtf('9 Uhr 50'));
	const previews = await plugin.previewFolders([{ label: 'Test.rtf', folder: dirname(itemPath), congress }]);

	const planned = previews[0].plan.notes.find(n => n.path === itemPath);
	assert.equal(planned.kind, 'unchanged');
});

// ── The overview note became mergeable in 1.26.0 ─────────────────────────
// It used to be rewritten wholesale, so a song number corrected there came
// back on the next update — the very trap the kept-block flag exists to
// close, left open in the one note where the programme is most visible.

test('a corrected line in the overview survives an update', async () => {
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const overviewPath = [...fake.notes.keys()].find(p => p.endsWith('Übersicht.md'));
	const congressPath = dirname(overviewPath);
	const lines = fake.notes.get(overviewPath).split('\n');
	const itemLine = lines.findIndex(l => l.startsWith('- ') && l.includes('9:40'));
	assert.ok(itemLine > 0, 'expected a programme line in the overview');

	const { markBlockKept } = await jitiWithObsidianStub.import('../src/util/noteMerge.ts');
	lines[itemLine] = lines[itemLine].replace('9:40', '10:15');
	fake.notes.set(overviewPath, markBlockKept(lines, itemLine).join('\n'));

	await plugin.updateFile('Test.rtf', makeRtf('9 Uhr 50'), congressPath);

	const after = fake.notes.get(overviewPath);
	assert.match(after, /10:15/);
	assert.doesNotMatch(after, /9:50/);
});

test('an overview written before markers existed is rewritten once, and merges from then on', async () => {
	// The migration: no markers means no anchor, so the file is rebuilt
	// exactly as it always was — and comes back with markers.
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const overviewPath = [...fake.notes.keys()].find(p => p.endsWith('Übersicht.md'));
	const congressPath = dirname(overviewPath);
	const markerFree = fake.notes.get(overviewPath)
		.replace(/^<span class="jw-marker" data-jw-(?:start|end)="[^"]+"><\/span>\n?/gm, '');
	fake.notes.set(overviewPath, markerFree);

	await plugin.updateFile('Test.rtf', makeRtf('9 Uhr 50'), congressPath);

	const after = fake.notes.get(overviewPath);
	assert.match(after, /9:50/);                       // brought up to date
	assert.match(after, /data-jw-start="session-1"/);  // and now carries markers
});

test('the overview keeps its list intact: no marker lands between two programme lines', async () => {
	// A marker sits on its own line, so one placed between list items would
	// split the list in two. They belong either side of the whole list.
	const fake = createFakeApp();
	const plugin = makePlugin(fake.app);
	await plugin.importFile('Test.rtf', makeRtf('9 Uhr 40'), '');

	const overview = [...fake.notes.keys()].find(p => p.endsWith('Übersicht.md'));
	const lines = fake.notes.get(overview).split('\n');
	for (let i = 1; i < lines.length - 1; i++) {
		if (!lines[i].includes('jw-marker')) continue;
		const between = lines[i - 1].startsWith('- ') && lines[i + 1].startsWith('- ');
		assert.equal(between, false, `marker on line ${i} splits the list`);
	}
});
