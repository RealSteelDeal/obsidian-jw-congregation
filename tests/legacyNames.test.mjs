import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { findLegacySpelling, sameUnderLegacySpelling } = await jiti.import('../src/util/legacyNames.ts');

test('a note name that carried a zero-width space is found under its clean name', () => {
	// English item titles carried one before a dash until 02.10.2026.
	const old = 'Forever\u200B—Is It Realistic?.md';
	assert.equal(findLegacySpelling([old, 'Other.md'], 'Forever—Is It Realistic?.md'), old);
});

test('a circuit-assembly folder with its theme quoted twice is found under the corrected name', () => {
	// What each language produced until 02.10.2026, against what it produces now.
	const cases = [
		['… – mit dem Kreisaufseher – „„Glücklich ist, wer auf Jehova vertraut““', '… – mit dem Kreisaufseher – „Glücklich ist, wer auf Jehova vertraut“'],
		['… – With Branch Representative – ““Find Exquisite Delight in Jehovah””', '… – With Branch Representative – “Find Exquisite Delight in Jehovah”'],
		['… – avec le responsable de circonscription – « « Heureux celui qui fait confiance à Jéhovah » »', '… – avec le responsable de circonscription – « Heureux celui qui fait confiance à Jéhovah »'],
		['… – com o Superintendente de Circuito – ʺ“Feliz é aquele que confia em Jeová”ʺ', '… – com o Superintendente de Circuito – “Feliz é aquele que confia em Jeová”'],
	];
	for (const [old, now] of cases) assert.equal(findLegacySpelling([old], now), old);
});

test('nothing is adopted when the name already exists', () => {
	const now = 'Forever—Is It Realistic?.md';
	assert.equal(findLegacySpelling([now, 'Forever\u200B—Is It Realistic?.md'], now), undefined);
});

test('nothing is adopted when two old spellings would fit, rather than guessing', () => {
	const names = ['Titel\u200B A.md', 'Titel A\u200B.md'];
	assert.equal(findLegacySpelling(names, 'Titel A.md'), undefined);
});

test('a different name is never mistaken for an old spelling', () => {
	assert.equal(findLegacySpelling(['Titel B.md', 'Titel A (2).md'], 'Titel A.md'), undefined);
	assert.equal(sameUnderLegacySpelling('„Titel“', '„Titel A“'), false);
});
