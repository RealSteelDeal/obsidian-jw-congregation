import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { findLegacyCorrections, applyLegacyCorrections } = await jiti.import('../src/util/legacyFieldPatch.ts');

// Only the four fields the module reads labels for — a real NoteStrings has
// many more, but findLegacyCorrections() never touches the rest.
const t = {
	dayLabel: 'Tag',
	timeLabel: 'Uhrzeit',
	scripturesLabel: 'Bibeltexte',
	nextLabel: 'Anschließend',
	speakerLabel: 'Redner',
};

test('proposes a correction when a label line appears exactly once in both existing and fresh, and differs', () => {
	const existing = ['**Tag:** Donnerstag', '**Redner:** Anna', ''].join('\n');
	const fresh = ['**Tag:** Freitag', '**Redner:**', ''].join('\n');

	const corrections = findLegacyCorrections(existing, fresh, t);
	assert.equal(corrections.length, 1);
	assert.equal(corrections[0].field, 'day');
	assert.equal(corrections[0].lineIndex, 0);
	assert.equal(corrections[0].oldLine, '**Tag:** Donnerstag');
	assert.equal(corrections[0].newLine, '**Tag:** Freitag');
});

test('proposes nothing for a field whose label is absent from the existing note', () => {
	const existing = ['**Redner:** Anna', ''].join('\n'); // no Tag line at all
	const fresh = ['**Tag:** Freitag', '**Redner:**', ''].join('\n');

	const corrections = findLegacyCorrections(existing, fresh, t);
	assert.equal(corrections.find(c => c.field === 'day'), undefined);
});

test('skips a field as ambiguous when its label line appears more than once (e.g. a multi-part symposium note)', () => {
	const existing = [
		'**Tag:** Donnerstag',
		'**Bibeltexte:** (Matthäus 5:1)',
		'## Teil 2',
		'**Bibeltexte:** (Lukas 6:17)',
	].join('\n');
	const fresh = [
		'**Tag:** Freitag',
		'**Bibeltexte:** (Matthäus 5:2)',
		'## Teil 2',
		'**Bibeltexte:** (Lukas 6:18)',
	].join('\n');

	const corrections = findLegacyCorrections(existing, fresh, t);
	// Day is unambiguous (single occurrence) and differs → proposed.
	assert.equal(corrections.some(c => c.field === 'day'), true);
	// Scriptures appears twice in both → ambiguous, never guessed at.
	assert.equal(corrections.some(c => c.field === 'scriptures'), false);
});

test('returns only the unambiguous corrections from a mixed note', () => {
	const existing = [
		'**Tag:** Donnerstag',
		'**Uhrzeit:** 09:00',
		'**Bibeltexte:** (Matthäus 5:1)',
		'**Bibeltexte:** (Lukas 6:17)',
	].join('\n');
	const fresh = [
		'**Tag:** Freitag',
		'**Uhrzeit:** 09:30',
		'**Bibeltexte:** (Matthäus 5:2)',
		'**Bibeltexte:** (Lukas 6:18)',
	].join('\n');

	const corrections = findLegacyCorrections(existing, fresh, t);
	const fields = corrections.map(c => c.field).sort();
	assert.deepEqual(fields, ['day', 'time']);
});

test('proposes nothing when the label line already matches the fresh content', () => {
	const existing = '**Tag:** Freitag';
	const fresh = '**Tag:** Freitag';
	assert.deepEqual(findLegacyCorrections(existing, fresh, t), []);
});

test('never proposes a Speaker correction — NoteBuilder never writes a value after that label, so it is not one of the four scanned fields', () => {
	const existing = '**Redner:** Anna';
	const fresh = '**Redner:**';
	assert.deepEqual(findLegacyCorrections(existing, fresh, t), []);
});

test('applyLegacyCorrections replaces only the accepted lines, leaving everything else byte-identical', () => {
	const content = ['**Tag:** Donnerstag', '**Uhrzeit:** 09:00', '**Redner:** Anna', ''].join('\n');
	const dayOnly = [{ field: 'day', lineIndex: 0, oldLine: '**Tag:** Donnerstag', newLine: '**Tag:** Freitag' }];

	const patched = applyLegacyCorrections(content, dayOnly);
	assert.match(patched, /\*\*Tag:\*\* Freitag/);
	assert.match(patched, /\*\*Uhrzeit:\*\* 09:00/); // untouched
	assert.match(patched, /Anna/); // untouched
});

test('applyLegacyCorrections silently skips a correction whose old line no longer matches (content drifted)', () => {
	const content = ['**Tag:** Mittwoch', '**Uhrzeit:** 09:00', ''].join('\n'); // user already changed "Tag" by hand
	const corrections = [
		{ field: 'day', lineIndex: 0, oldLine: '**Tag:** Donnerstag', newLine: '**Tag:** Freitag' }, // stale expectation
		{ field: 'time', lineIndex: 1, oldLine: '**Uhrzeit:** 09:00', newLine: '**Uhrzeit:** 09:30' },
	];

	const patched = applyLegacyCorrections(content, corrections);
	assert.match(patched, /\*\*Tag:\*\* Mittwoch/); // day correction skipped, user's edit preserved
	assert.match(patched, /\*\*Uhrzeit:\*\* 09:30/); // time correction still applied
});
