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

// ── English programme structures (synthetic fixtures, no copyrighted text) ──

test('parseLi recognizes an English song line (jwpub://p/E: link, "Song No. NNN")', () => {
	const dom = parseHtml(`
		<ul><li>
			<p>9:30 <a href="jwpub://p/E:1102022960/">Song No. 160</a> and Prayer</p>
		</li></ul>
	`);
	const item = parser()['parseLi'](dom.querySelector('li'));
	assert.equal(item.itemType, 'song');
	assert.equal(item.songNumber, 160);
	// The real docid must come from the href — the language symbol before the
	// colon varies per language (X/E/…) and must not be hardcoded.
	assert.equal(item.songDocid, 1102022960);
	assert.equal(item.title, '9:30 Song No. 160 and Prayer'.replace('9:30 ', ''));
});

test('parseLi treats English music/break lines as asides', () => {
	const p = parser();
	for (const text of ['Music-Video Presentation', 'Music', 'Intermission']) {
		const dom = parseHtml(`<ul><li><p>9:20 ${text}</p></li></ul>`);
		const item = p['parseLi'](dom.querySelector('li'));
		assert.equal(item.itemType, 'aside', `"${text}" should be an aside`);
		assert.equal(item.title, text);
	}
});

test('parseLi strips English type markers (CHAIRMAN’S ADDRESS, PUBLIC BIBLE DISCOURSE) from the title', () => {
	const p = parser();
	for (const marker of ['CHAIRMAN’S ADDRESS:', 'PUBLIC BIBLE DISCOURSE:']) {
		const dom = parseHtml(`
			<ul><li>
				<p>9:40 <span class="du-color--gold"><strong>${marker}</strong></span> An Example Title (<a href="jwpub://b/NWTR/19:16:11-19:16:11">Testbook 16:11</a>)</p>
			</li></ul>
		`);
		const item = p['parseLi'](dom.querySelector('li'));
		assert.equal(item.itemType, 'talk');
		assert.equal(item.title, 'An Example Title', `marker "${marker}" must be stripped`);
	}
});

test('extractDayName finds English weekdays and falls back per language for CA files', () => {
	const p = parser();
	const friday = parseHtml('<h1>Friday</h1><div class="bodyTxt"><h2>Morning</h2></div>');
	assert.equal(p['extractDayName'](friday), 'Friday');

	// CA files: h1 holds the theme, not a weekday — fallback follows the
	// detected file language.
	const ca = parseHtml('<h1>“An Example Theme”</h1><div class="bodyTxt"><h2>Morning</h2></div>');
	p['lang'] = 'en';
	assert.equal(p['extractDayName'](ca), 'Saturday');
	p['lang'] = 'de';
	assert.equal(p['extractDayName'](ca), 'Samstag');
});

test('extractQuestionsDocument matches the English "Find Answers to These Questions:" heading', () => {
	const p = parser();
	p['lang'] = 'en';
	const dom = parseHtml(`
		<header><h1>Find Answers to These Questions:</h1></header>
		<div class="bodyTxt"><ul class="source">
			<li><p>1. An example question? (<a href="jwpub://b/NWTR/19:16:11-19:16:11">Testbook 16:11</a>)</p></li>
			<li><p>2. Another example question?</p></li>
		</ul></div>
	`);
	const item = p['extractQuestionsDocument'](dom);
	assert.ok(item, 'English questions document must be recognized');
	assert.equal(item.title, 'Find Answers to These Questions');
	assert.equal(item.parts.length, 2);
});
