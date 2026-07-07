/**
 * Unit tests for JwpubParser's HTML-parsing helpers. Uses hand-written,
 * fictional markup shaped like the real jwpub HTML structure — never actual
 * congress programme text, to keep copyrighted content out of the repo.
 *
 * Private methods are reached via bracket-notation (TypeScript's `private`
 * is compile-time only), which is the simplest way to unit-test them without
 * needing a full encrypted .jwpub fixture just to reach a text helper.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { JwpubParser } = await jiti.import('../src/parser/JwpubParser.ts');

function parser() {
	// sqlWasmBinary is only needed by parse()/openContents(); none of the
	// methods under test here touch it.
	return new JwpubParser(new Uint8Array());
}

function parseHtml(html) {
	return new DOMParser().parseFromString(html, 'text/html');
}

test('stripScriptureCitation removes a trailing parenthetical citation', () => {
	const p = parser();
	assert.equal(
		p['stripScriptureCitation']('Ein Beispieltitel (Testbuch 1:2)'),
		'Ein Beispieltitel',
	);
});

test('stripScriptureCitation leaves text without a trailing citation untouched', () => {
	const p = parser();
	assert.equal(p['stripScriptureCitation']('Ein Beispieltitel ohne Zitat'), 'Ein Beispieltitel ohne Zitat');
});

test('stripScriptureCitation handles multiple semicolon-separated references', () => {
	const p = parser();
	assert.equal(
		p['stripScriptureCitation']('Titel (Testbuch 1:2-3:4; Zweitbuch 5:6)'),
		'Titel',
	);
});

test('extractDayTheme reads the quote + scripture paragraph right after <header>', () => {
	const dom = parseHtml(`
		<header><h1>Beispieltag</h1></header>
		<p><span>„Ein Beispielzitat“ (<a href="jwpub://b/NWTR/40:5:3-40:5:3">Testbuch 5:3</a>)</span></p>
		<div class="bodyTxt"></div>
	`);
	const { theme, themeScripture } = parser()['extractDayTheme'](dom);
	assert.equal(theme, '„Ein Beispielzitat“');
	// verseEnd == verseStart for a same-verse href ("40:5:3-40:5:3") — fromJwpub
	// always sets it for an explicit range; ScriptureNormalizer.format() is what
	// hides it again when the two are equal.
	assert.deepEqual(themeScripture, { book: 40, chapter: 5, verseStart: 3, verseEnd: 3 });
});

test('extractDayTheme returns only the scripture when the paragraph has no quote text of its own', () => {
	// CA-style congresses: the motto is already the page's own <h1>, so the
	// paragraph after <header> cites only the scripture, nothing else.
	const dom = parseHtml(`
		<header><h1>„Der Titel ist hier schon das Motto“</h1></header>
		<p class="themeScrp"><a href="jwpub://b/NWTR/20:16:20-20:16:20">Testbuch 16:20</a></p>
		<div class="bodyTxt"></div>
	`);
	const { theme, themeScripture } = parser()['extractDayTheme'](dom);
	assert.equal(theme, undefined);
	assert.deepEqual(themeScripture, { book: 20, chapter: 16, verseStart: 20, verseEnd: 20 });
});

test('extractDayTheme returns nothing when there is no paragraph right after <header>', () => {
	const dom = parseHtml(`<header><h1>Beispieltag</h1></header><div class="bodyTxt"></div>`);
	assert.deepEqual(parser()['extractDayTheme'](dom), {});
});

test('parseBibleDrama strips the scripture citation from the episode subtitle instead of duplicating it', () => {
	// Regression test: the subtitle used to keep its own "(Testbuch 1:2)" text
	// verbatim, so the same reference showed up twice — once as plain text in
	// the subtitle, once as its own linked entry in item.scriptures.
	const dom = parseHtml(`
		<ul><li>
			<p>9:50 BIBELDRAMA:</p>
			<p><strong><em>Serientitel</em></strong></p>
			<p><em>Folge 1: „Ein Beispielzitat“</em> (<a href="jwpub://b/NWTR/40:5:3-40:5:3">Testbuch 5:3</a>)</p>
		</li></ul>
	`);
	const li = dom.querySelector('li');
	const item = parser()['parseBibleDrama'](li, '9:50', 'bible-drama');

	assert.equal(item.title, 'Serientitel');
	assert.equal(item.subtitle, 'Folge 1: „Ein Beispielzitat“');
	assert.ok(!item.subtitle.includes('Testbuch'), 'citation must not remain in the subtitle text');
	assert.deepEqual(item.scriptures, [{ book: 40, chapter: 5, verseStart: 3, verseEnd: 3 }]);
});
