import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { mergeNoteContent, hasNoMarkers } = await jiti.import('../src/util/noteMerge.ts');

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
