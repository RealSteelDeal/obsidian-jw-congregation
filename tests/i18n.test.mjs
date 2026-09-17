import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { L, displayName } = await jiti.import('../src/i18n.ts');

const LANGS = ['de', 'en', 'fr', 'it', 'pt', 'ru', 'es'];

test('displayName gives each UI language its own wording for a programme language', () => {
	assert.equal(displayName('fr', 'de'), 'Französisch');
	assert.equal(displayName('fr', 'es'), 'Francés');
	assert.equal(displayName('ru', 'ru'), 'Русский');
});

test('every programme language has an English name — the fallback depends on it', () => {
	// displayName falls back to the English wording when a UI language has none
	// of its own, so a missing English entry would turn into undefined text in
	// the import dialog rather than a compile error.
	for (const lang of LANGS) {
		assert.equal(typeof displayName(lang, 'en'), 'string');
		assert.ok(displayName(lang, 'en').length > 0, lang);
	}
});

test('displayName resolves every programme/UI language pair', () => {
	for (const lang of LANGS) {
		for (const ui of LANGS) {
			const name = displayName(lang, ui);
			assert.ok(typeof name === 'string' && name.length > 0, `${lang}/${ui}`);
		}
	}
});

test('each language exposes the six parser strings, not just interface text', () => {
	// These drive the parser rather than the interface (see the note on L), so
	// a language added later must not be left with only interface strings.
	for (const lang of LANGS) {
		for (const key of ['caFallbackDay', 'defaultSession', 'reviewQuestionsSession', 'questionsTitle', 'bibleDramaFallback']) {
			assert.equal(typeof L[lang][key], 'string', `${lang}.${key}`);
		}
		assert.equal(typeof L[lang].song, 'function', `${lang}.song`);
	}
});
