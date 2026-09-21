/**
 * Tests for the speaker-name grouping (src/util/speakerNames.ts).
 *
 * The three spellings used throughout are the ones actually reported from a
 * real vault on 21.09.2026 — "Br. Sieberer", "Hannes Sieberer", "Sieberer
 * Hannes" — not invented examples. What matters here is not that the
 * heuristic is clever but that it never merges two people on its own: every
 * group it proposes is confirmed by the user before anything is written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { nameTokens, groupSpeakerVariants, speakerLink, speakerLineValue } =
	await jiti.import('../src/util/speakerNames.ts');

/** Shorthand: n occurrences of one spelling, each in its own note. */
function occ(text, count = 1) {
	return Array.from({ length: count }, (_, i) => ({ path: `${text}-${i}.md`, line: 3, text }));
}

test('the same name in either word order produces the same words', () => {
	assert.deepEqual([...nameTokens('Hannes Sieberer')].sort(), ['hannes', 'sieberer']);
	assert.deepEqual([...nameTokens('Sieberer Hannes')].sort(), ['hannes', 'sieberer']);
});

test('a form of address is not part of the name', () => {
	assert.deepEqual([...nameTokens('Br. Sieberer')], ['sieberer']);
	assert.deepEqual([...nameTokens('Bruder Sieberer')], ['sieberer']);
	assert.deepEqual([...nameTokens('Brother Sieberer')], ['sieberer']);
	// All seven note languages at once: the field is free text, so nothing
	// says it was written in the note's own language.
	assert.deepEqual([...nameTokens('Hermano Sieberer')], ['sieberer']);
	assert.deepEqual([...nameTokens('Брат Сиберер')], ['сиберер']);
});

test('groups the three reported spellings of one brother, and suggests the fullest', () => {
	const groups = groupSpeakerVariants([
		...occ('Br. Sieberer', 2),
		...occ('Hannes Sieberer', 3),
		...occ('Sieberer Hannes'),
	]);

	assert.equal(groups.length, 1);
	assert.equal(groups[0].suggested, 'Hannes Sieberer'); // most complete, then most frequent
	assert.deepEqual(groups[0].variants.sort(), ['Br. Sieberer', 'Hannes Sieberer', 'Sieberer Hannes']);
	assert.equal(groups[0].occurrences.length, 6);
	assert.equal(groups[0].ambiguous, false);
});

test('keeps two different people apart even when they share a first name', () => {
	const groups = groupSpeakerVariants([...occ('Hannes Sieberer'), ...occ('Hannes Müller')]);
	assert.equal(groups.length, 2);
	assert.deepEqual(groups.map(g => g.suggested).sort(), ['Hannes Müller', 'Hannes Sieberer']);
});

test('refuses to place a shortening that fits two people, and says why', () => {
	// "Br. Hannes" could be either brother. Assigning it to whichever was
	// seen first is exactly the silent wrong merge this design exists to
	// prevent — it stays on its own, flagged.
	const groups = groupSpeakerVariants([
		...occ('Hannes Sieberer'),
		...occ('Hannes Müller'),
		...occ('Br. Hannes'),
	]);

	assert.equal(groups.length, 3);
	const ambiguous = groups.find(g => g.suggested === 'Br. Hannes');
	assert.equal(ambiguous.ambiguous, true);
	assert.ok(groups.filter(g => g.suggested !== 'Br. Hannes').every(g => g.ambiguous === false));
});

test('a shortening reaches the full name even when it is seen first', () => {
	// Entries are ordered by completeness before grouping, so the group is
	// anchored by the full name regardless of the order they arrive in.
	const groups = groupSpeakerVariants([...occ('Br. Sieberer'), ...occ('Hannes Sieberer')]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].suggested, 'Hannes Sieberer');
});

test('ignores empty and honorific-only entries rather than grouping them', () => {
	// "Br." on its own carries no name at all; treating it as a person would
	// sweep every unnamed talk into one bogus entry.
	const groups = groupSpeakerVariants([...occ('Br.'), ...occ('   '), ...occ('Hannes Sieberer')]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].suggested, 'Hannes Sieberer');
});

test('a link keeps the original wording visible whenever it differs', () => {
	// The migration must not change one character the reader sees — only
	// what Obsidian resolves underneath.
	assert.equal(speakerLink('Hannes Sieberer', 'Br. Sieberer'), '[[Hannes Sieberer|Br. Sieberer]]');
	assert.equal(speakerLink('Hannes Sieberer', 'Hannes Sieberer'), '[[Hannes Sieberer]]');
});

test('reads the value off a written-out Speaker line', () => {
	assert.equal(speakerLineValue('**Redner:** Br. Sieberer', 'Redner'), 'Br. Sieberer');
	assert.equal(speakerLineValue('**Speaker:** Hannes Sieberer', 'Speaker'), 'Hannes Sieberer');
	assert.equal(speakerLineValue('**Докладчик:** Брат Сиберер', 'Докладчик'), 'Брат Сиберер');
});

test('skips a Speaker line that is empty or already a link', () => {
	// The empty label is what NoteBuilder itself writes — by far the most
	// common line, and there is nothing in it to convert.
	assert.equal(speakerLineValue('**Redner:**', 'Redner'), null);
	assert.equal(speakerLineValue('**Redner:** ', 'Redner'), null);
	assert.equal(speakerLineValue('**Redner:** [[Hannes Sieberer]]', 'Redner'), null);
	assert.equal(speakerLineValue('**Redner:** [[Hannes Sieberer|Br. Sieberer]]', 'Redner'), null);
});

test('does not mistake another field, or prose, for the Speaker line', () => {
	assert.equal(speakerLineValue('**Uhrzeit:** 9:40', 'Redner'), null);
	assert.equal(speakerLineValue('Der Redner: Bruder Sieberer', 'Redner'), null);
	assert.equal(speakerLineValue('**Redner:** Br. Sieberer', 'Uhrzeit'), null);
});
