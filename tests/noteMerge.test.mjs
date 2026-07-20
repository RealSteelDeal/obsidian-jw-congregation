import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { mergeNoteContent } = await jiti.import('../src/util/noteMerge.ts');

test('replaces a marked block with the fresh version, keeping surrounding user content untouched', () => {
	const existing = [
		'%%jw:header%%',
		'**Tag:** Donnerstag',
		'%%/jw:header%%',
		'**Redner:** Bruder Schmidt',
		'',
		'Meine eigenen Notizen zum Vortrag.',
		'',
	].join('\n');
	const fresh = [
		'%%jw:header%%',
		'**Tag:** Freitag',
		'%%/jw:header%%',
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
		'%%jw:header%%',
		'**Tag:** Donnerstag',
		'%%/jw:header%%',
		'**Redner:** Anna',
		'',
		'%%jw:footer%%',
		'**Anschließend:** [[01. Altes Ziel]]',
		'%%/jw:footer%%',
	].join('\n');
	const fresh = [
		'%%jw:header%%',
		'**Tag:** Freitag',
		'%%/jw:header%%',
		'**Redner:**',
		'',
		'%%jw:footer%%',
		'**Anschließend:** [[01. Neues Ziel]]',
		'%%/jw:footer%%',
	].join('\n');

	const merged = mergeNoteContent(existing, fresh);
	assert.ok(merged);
	assert.match(merged, /Freitag/);
	assert.match(merged, /Anna/);
	assert.match(merged, /Neues Ziel/);
	assert.doesNotMatch(merged, /Altes Ziel/);
});

test('replaces YAML frontmatter outright (fully machine-generated, no user content expected)', () => {
	const existing = ['---', 'day: Donnerstag', '---', '', '%%jw:header%%', 'old', '%%/jw:header%%', 'user text'].join('\n');
	const fresh = ['---', 'day: Freitag', '---', '', '%%jw:header%%', 'new', '%%/jw:header%%', ''].join('\n');

	const merged = mergeNoteContent(existing, fresh);
	assert.ok(merged);
	assert.match(merged, /day: Freitag/);
	assert.match(merged, /user text/);
});

test('returns null when the existing note has no markers at all (pre-feature note — needs a full reimport)', () => {
	const existing = '**Tag:** Donnerstag\n**Redner:** Anna\n';
	const fresh = '%%jw:header%%\n**Tag:** Freitag\n%%/jw:header%%\n**Redner:**\n';
	assert.equal(mergeNoteContent(existing, fresh), null);
});

test('returns null when marker ids differ in count or order between existing and fresh', () => {
	const existing = '%%jw:header%%\nA\n%%/jw:header%%\n';
	const freshMissingBlock = '%%jw:header%%\nA\n%%/jw:header%%\n%%jw:footer%%\nB\n%%/jw:footer%%\n';
	assert.equal(mergeNoteContent(existing, freshMissingBlock), null);

	const existingTwoBlocks = '%%jw:header%%\nA\n%%/jw:header%%\n%%jw:footer%%\nB\n%%/jw:footer%%\n';
	const freshReordered = '%%jw:footer%%\nB\n%%/jw:footer%%\n%%jw:header%%\nA\n%%/jw:header%%\n';
	assert.equal(mergeNoteContent(existingTwoBlocks, freshReordered), null);
});

test('returns null for an unbalanced/malformed marker in the existing file', () => {
	const existing = '%%jw:header%%\nA\n'; // never closed
	const fresh = '%%jw:header%%\nA\n%%/jw:header%%\n';
	assert.equal(mergeNoteContent(existing, fresh), null);
});

test('returns null when frontmatter is present in one version but not the other', () => {
	const existingWithFm = '---\nday: Donnerstag\n---\n\n%%jw:header%%\nA\n%%/jw:header%%\n';
	const freshWithoutFm = '%%jw:header%%\nA\n%%/jw:header%%\n';
	assert.equal(mergeNoteContent(existingWithFm, freshWithoutFm), null);
});

test('leaves an empty note with only markers and no user content fully consistent with fresh', () => {
	const existing = '%%jw:header%%\nold value\n%%/jw:header%%\n';
	const fresh = '%%jw:header%%\nnew value\n%%/jw:header%%\n';
	assert.equal(mergeNoteContent(existing, fresh), fresh);
});
