import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { stripZeroWidthSpace, MEPS_LANGUAGE_INDEX, englishSymbol } = await jiti.import('../src/util/jwpubLinks.ts');

test('stripZeroWidthSpace removes every U+200B', () => {
	assert.equal(stripZeroWidthSpace('질문\u200b에 대한 답\u200b을'), '질문에 대한 답을');
	assert.equal(stripZeroWidthSpace('\u200b\u200b'), '');
});

test('stripZeroWidthSpace leaves the joiners that carry meaning', () => {
	// ZWNJ and ZWJ change how some scripts and emoji render; only the space
	// the Korean files were measured to carry is removed.
	assert.equal(stripZeroWidthSpace('a\u200cb\u200dc'), 'a\u200cb\u200dc');
});

test('stripZeroWidthSpace leaves ordinary text untouched', () => {
	assert.equal(stripZeroWidthSpace('Ewiges Glück'), 'Ewiges Glück');
});

test('MEPS language 129 is Korean', () => {
	// Read from nwt_KO.jwpub, then found unchanged in all three Korean
	// convention programmes.
	assert.equal(MEPS_LANGUAGE_INDEX[129], 'ko');
});

test('a publication is recognised by its English symbol, not its localised one', () => {
	// The Korean Meeting Workbook calls itself "집교26"; only EnglishSymbol
	// says what it is. Checking Symbol rejected it as "not a workbook".
	assert.equal(englishSymbol({ Symbol: '집교26', EnglishSymbol: 'mwb26' }), 'mwb26');
	assert.equal(englishSymbol({ Symbol: 'mwb26', EnglishSymbol: 'mwb26' }), 'mwb26');
});

test('a file without an English symbol falls back to its own', () => {
	assert.equal(englishSymbol({ Symbol: 'CO-pgm26' }), 'CO-pgm26');
	assert.equal(englishSymbol({ Symbol: 'CO-pgm26', EnglishSymbol: '' }), 'CO-pgm26');
});
