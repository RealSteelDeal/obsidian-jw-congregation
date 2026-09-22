import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { mergeNoteContent, hasNoMarkers, diffNoteContent, markBlockKept } = await jiti.import('../src/util/noteMerge.ts');

// Current (1.18.1+) marker format — invisible via this plugin's own
// `.jw-marker { display: none; }` CSS rule, unlike the pre-1.18.1 `%%jw:id%%`
// format below, which turned out to always render as visible dimmed text in
// Live Preview (Obsidian has no built-in fully-invisible handling for %%…%%
// specifically, independent of cursor position).
const start = id => `<span class="jw-marker" data-jw-start="${id}"></span>`;
const end = id => `<span class="jw-marker" data-jw-end="${id}"></span>`;

test('replaces a marked block with the fresh version, keeping surrounding user content untouched', () => {
	const existing = [
		start('header'),
		'**Tag:** Donnerstag',
		end('header'),
		'**Redner:** Bruder Schmidt',
		'',
		'Meine eigenen Notizen zum Vortrag.',
		'',
	].join('\n');
	const fresh = [
		start('header'),
		'**Tag:** Freitag',
		end('header'),
		'**Redner:**',
		'',
		'',
	].join('\n');

	const merged = mergeNoteContent(existing, fresh);
	assert.ok(merged);
	assert.match(merged, /\*\*Tag:\*\* Freitag/);
	assert.match(merged, /Bruder Schmidt/);
	assert.match(merged, /Meine eigenen Notizen zum Vortrag\./);
	assert.doesNotMatch(merged, /Donnerstag/);
});

test('merges multiple marker blocks (header + footer) independently', () => {
	const existing = [
		start('header'),
		'**Tag:** Donnerstag',
		end('header'),
		'**Redner:** Anna',
		'',
		start('footer'),
		'**Anschließend:** [[01. Altes Ziel]]',
		end('footer'),
	].join('\n');
	const fresh = [
		start('header'),
		'**Tag:** Freitag',
		end('header'),
		'**Redner:**',
		'',
		start('footer'),
		'**Anschließend:** [[01. Neues Ziel]]',
		end('footer'),
	].join('\n');

	const merged = mergeNoteContent(existing, fresh);
	assert.ok(merged);
	assert.match(merged, /Freitag/);
	assert.match(merged, /Anna/);
	assert.match(merged, /Neues Ziel/);
	assert.doesNotMatch(merged, /Altes Ziel/);
});

test('replaces YAML frontmatter outright (fully machine-generated, no user content expected)', () => {
	const existing = ['---', 'day: Donnerstag', '---', '', start('header'), 'old', end('header'), 'user text'].join('\n');
	const fresh = ['---', 'day: Freitag', '---', '', start('header'), 'new', end('header'), ''].join('\n');

	const merged = mergeNoteContent(existing, fresh);
	assert.ok(merged);
	assert.match(merged, /day: Freitag/);
	assert.match(merged, /user text/);
});

test('returns null when the existing note has no markers at all (pre-feature note — needs a full reimport)', () => {
	const existing = '**Tag:** Donnerstag\n**Redner:** Anna\n';
	const fresh = `${start('header')}\n**Tag:** Freitag\n${end('header')}\n**Redner:**\n`;
	assert.equal(mergeNoteContent(existing, fresh), null);
});

test('returns null when marker ids differ in count or order between existing and fresh', () => {
	const existing = `${start('header')}\nA\n${end('header')}\n`;
	const freshMissingBlock = `${start('header')}\nA\n${end('header')}\n${start('footer')}\nB\n${end('footer')}\n`;
	assert.equal(mergeNoteContent(existing, freshMissingBlock), null);

	const existingTwoBlocks = `${start('header')}\nA\n${end('header')}\n${start('footer')}\nB\n${end('footer')}\n`;
	const freshReordered = `${start('footer')}\nB\n${end('footer')}\n${start('header')}\nA\n${end('header')}\n`;
	assert.equal(mergeNoteContent(existingTwoBlocks, freshReordered), null);
});

test('returns null for an unbalanced/malformed marker in the existing file', () => {
	const existing = `${start('header')}\nA\n`; // never closed
	const fresh = `${start('header')}\nA\n${end('header')}\n`;
	assert.equal(mergeNoteContent(existing, fresh), null);
});

test('returns null when frontmatter is present in one version but not the other', () => {
	const existingWithFm = `---\nday: Donnerstag\n---\n\n${start('header')}\nA\n${end('header')}\n`;
	const freshWithoutFm = `${start('header')}\nA\n${end('header')}\n`;
	assert.equal(mergeNoteContent(existingWithFm, freshWithoutFm), null);
});

test('leaves an empty note with only markers and no user content fully consistent with fresh', () => {
	const existing = `${start('header')}\nold value\n${end('header')}\n`;
	const fresh = `${start('header')}\nnew value\n${end('header')}\n`;
	assert.equal(mergeNoteContent(existing, fresh), fresh);
});

test('hasNoMarkers() is true for a note with no marker line at all (the legacy-migration gate)', () => {
	const content = '**Tag:** Donnerstag\n**Redner:** Anna\n';
	assert.equal(hasNoMarkers(content), true);
});

test('hasNoMarkers() is false when at least one marker start or end line is present', () => {
	assert.equal(hasNoMarkers(`${start('header')}\n**Tag:** Freitag\n${end('header')}\n`), false);
	// Even a single, unpaired/malformed marker must still count as "has markers" —
	// this is exactly the case that must NOT fall through to the text heuristic.
	assert.equal(hasNoMarkers(`${start('header')}\n**Tag:** Freitag\n`), false);
});

// ── Backward compatibility: notes generated by 1.9.0–1.18.0 (the old %%jw:id%% format) ──

test('mergeNoteContent still merges an existing note written in the legacy %%jw:id%% format', () => {
	const existingLegacy = ['%%jw:header%%', '**Tag:** Donnerstag', '%%/jw:header%%', '**Redner:** Anna', ''].join('\n');
	const fresh = [start('header'), '**Tag:** Freitag', end('header'), '**Redner:**', ''].join('\n');

	const merged = mergeNoteContent(existingLegacy, fresh);
	assert.ok(merged, 'a legacy-format existing note must still merge against a current-format fresh render');
	assert.match(merged, /Freitag/);
	assert.match(merged, /Anna/);
	// The merged result adopts the FRESH block's format — a legacy note is
	// silently upgraded to the new span markers the moment it's merged once.
	assert.match(merged, /<span class="jw-marker" data-jw-start="header">/);
	assert.doesNotMatch(merged, /%%jw:header%%/);
});

test('hasNoMarkers() still recognizes the legacy %%jw:id%% format as "has markers"', () => {
	assert.equal(hasNoMarkers('%%jw:header%%\n**Tag:** Freitag\n%%/jw:header%%\n'), false);
	assert.equal(hasNoMarkers('%%jw:header%%\n**Tag:** Freitag\n'), false);
});

test('mergeNoteContent never WRITES the legacy %%jw:id%% format, even when merging a legacy existing note', () => {
	const existingLegacy = '%%jw:header%%\nold\n%%/jw:header%%\n';
	const fresh = `${start('header')}\nnew\n${end('header')}\n`;
	const merged = mergeNoteContent(existingLegacy, fresh);
	assert.ok(merged);
	assert.doesNotMatch(merged, /%%/);
});

// ── diffNoteContent: what the preview shows ────────────────────────────────
// The rule these tests exist to pin down: the preview must report a change
// exactly when the merge would make one, and refuse exactly when it refuses.
// A preview computed by its own rules would eventually disagree with the
// write it precedes, which is the one failure this feature cannot afford.

test('diffNoteContent reports the changed block, with its content and without the marker lines', () => {
	const existing = [start('time'), '**Uhrzeit:** 9:40', end('time'), '**Redner:** Bruder Schmidt'].join('\n');
	const fresh = [start('time'), '**Uhrzeit:** 9:50', end('time'), '**Redner:**'].join('\n');

	assert.deepEqual(diffNoteContent(existing, fresh), [
		{ id: 'time', before: '**Uhrzeit:** 9:40', after: '**Uhrzeit:** 9:50' },
	]);
});

test('diffNoteContent reports nothing for text the user typed outside every marker', () => {
	// The merge leaves it alone, so the preview must not announce it — this is
	// exactly what the user is looking at the preview to confirm.
	const existing = [start('time'), '**Uhrzeit:** 9:40', end('time'), 'Meine eigene Notiz.'].join('\n');
	const fresh = [start('time'), '**Uhrzeit:** 9:40', end('time'), ''].join('\n');

	assert.deepEqual(diffNoteContent(existing, fresh), []);
});

test('diffNoteContent reports each changed block separately and skips the unchanged ones', () => {
	const existing = [
		start('header'), '**Tag:** Donnerstag', end('header'),
		'Eigener Text.',
		start('footer'), '**Anschließend:** Lied 12', end('footer'),
	].join('\n');
	const fresh = [
		start('header'), '**Tag:** Freitag', end('header'),
		'',
		start('footer'), '**Anschließend:** Lied 12', end('footer'),
	].join('\n');

	assert.deepEqual(diffNoteContent(existing, fresh).map(c => c.id), ['header']);
});

test('diffNoteContent reports a changed frontmatter block under a null id', () => {
	// Frontmatter is machine-generated and replaced as a whole, so it has no
	// marker of its own — but it does get written, so it has to be shown.
	const existing = ['---', 'time: "9:40"', '---', start('a'), 'x', end('a')].join('\n');
	const fresh = ['---', 'time: "9:50"', '---', start('a'), 'x', end('a')].join('\n');

	const changes = diffNoteContent(existing, fresh);
	assert.equal(changes.length, 1);
	assert.equal(changes[0].id, null);
	assert.match(changes[0].after, /9:50/);
});

test('diffNoteContent returns null in exactly the cases mergeNoteContent refuses', () => {
	const fresh = [start('a'), 'neu', end('a')].join('\n');
	const refused = [
		'Eine Notiz ganz ohne Marker.',                                   // pre-1.9.0
		[start('a'), 'x', end('b')].join('\n'),                           // mismatched ids
		[start('a'), 'x'].join('\n'),                                     // unclosed
		['---', 'k: v', '---', start('a'), 'x', end('a')].join('\n'),     // frontmatter only on one side
	];
	for (const existing of refused) {
		assert.equal(mergeNoteContent(existing, fresh), null, existing);
		assert.equal(diffNoteContent(existing, fresh), null, existing);
	}
});

test('diffNoteContent reports no change when only the marker format is upgraded', () => {
	// A 1.9.0–1.18.0 note: the merge rewrites the file (%%jw:id%% becomes a
	// span), but not one character the reader ever sees. Reporting that as a
	// change would be noise; reporting the file as untouched would be a lie,
	// which is why the caller distinguishes the two.
	const existing = ['%%jw:time%%', '**Uhrzeit:** 9:40', '%%/jw:time%%'].join('\n');
	const fresh = [start('time'), '**Uhrzeit:** 9:40', end('time')].join('\n');

	assert.deepEqual(diffNoteContent(existing, fresh), []);
	assert.notEqual(mergeNoteContent(existing, fresh), existing); // written all the same
});

// ── Blocks the user corrected themselves ──────────────────────────────────
// A derived field the user fixed on purpose (a song the congregation actually
// sang, a reference the programme got wrong) must survive the next update.
// Without that, offering the correction at all would be a trap: it would look
// as though it worked and quietly revert later.

const keptStart = id => `<span class="jw-marker" data-jw-start="${id}" data-jw-kept="1"></span>`;

test('markBlockKept flags the block a line sits in, and only its opening marker', () => {
	const lines = [start('hint'), '**Anschließend:** Lied 12', end('hint'), 'Mein Text.'];
	const marked = markBlockKept(lines, 1);

	assert.equal(marked[0], keptStart('hint'));
	assert.equal(marked[1], '**Anschließend:** Lied 12'); // content untouched
	assert.equal(marked[2], end('hint')); // closing marker untouched
	assert.equal(marked[3], 'Mein Text.');
});

test('markBlockKept leaves lines outside every block alone', () => {
	// The user's own text is never overwritten in the first place, so there is
	// nothing to protect and no flag to add.
	const lines = [start('hint'), 'Feld', end('hint'), 'Mein eigener Text.'];
	assert.deepEqual(markBlockKept(lines, 3), lines);
	assert.deepEqual(markBlockKept(lines, 0), lines); // the marker line itself
});

test('markBlockKept is idempotent and never doubles the flag', () => {
	const lines = [start('hint'), 'Feld', end('hint')];
	const once = markBlockKept(lines, 1);
	assert.deepEqual(markBlockKept(once, 1), once);
});

test('a kept block survives an update that would otherwise rewrite it', () => {
	const existing = [keptStart('hint'), '**Anschließend:** Lied 45', end('hint')].join('\n');
	const fresh = [start('hint'), '**Anschließend:** Lied 12', end('hint')].join('\n');

	// The programme still says 12; the congregation sang 45 and the user said so.
	assert.equal(mergeNoteContent(existing, fresh), existing);
});

test('a kept block does not stop its neighbours from being updated', () => {
	const existing = [
		start('header'), '**Uhrzeit:** 9:40', end('header'),
		keptStart('hint'), '**Anschließend:** Lied 45', end('hint'),
	].join('\n');
	const fresh = [
		start('header'), '**Uhrzeit:** 9:50', end('header'),
		start('hint'), '**Anschließend:** Lied 12', end('hint'),
	].join('\n');

	const merged = mergeNoteContent(existing, fresh);
	assert.match(merged, /9:50/);       // the corrected time still lands
	assert.match(merged, /Lied 45/);    // the user's own correction stands
	assert.doesNotMatch(merged, /Lied 12/);
});

test('the preview does not announce a change to a kept block', () => {
	// It would be listing a change that the merge then refuses to make.
	const existing = [keptStart('hint'), '**Anschließend:** Lied 45', end('hint')].join('\n');
	const fresh = [start('hint'), '**Anschließend:** Lied 12', end('hint')].join('\n');

	assert.deepEqual(diffNoteContent(existing, fresh), []);
});

test('a kept marker is still recognised as a marker at all', () => {
	// Otherwise the note would look marker-free and be swept into the
	// pre-1.9.0 heuristic, which knows nothing about markers.
	const content = [keptStart('hint'), 'Feld', end('hint')].join('\n');
	assert.equal(hasNoMarkers(content), false);
});
