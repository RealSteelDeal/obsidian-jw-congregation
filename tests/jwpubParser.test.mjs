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

// ── Weekdays outside ASCII ──────────────────────────────────────────────────

test('extractDayName finds weekdays that begin or end outside ASCII', () => {
	// \b is ASCII-only in JavaScript even with the u flag, so it found no
	// boundary next to "ì", Cyrillic or Hangul. Until 02.10.2026 these all
	// fell through to the one-day fallback: an Italian convention got two
	// Saturdays, a Russian one three — the item counts still matched.
	const p = parser();
	for (const day of ['Venerdì', 'Пятница', 'Суббота', 'Воскресенье', '금요일', '토요일', '일요일']) {
		const dom = parseHtml(`<h1>${day}</h1><div class="bodyTxt"><h2>x</h2></div>`);
		assert.equal(p['extractDayName'](dom), day);
	}
});

test('extractDayName still needs a whole word, not part of one', () => {
	const p = parser();
	p['lang'] = 'de';
	// Neither is the weekday on its own; both fall to the one-day fallback.
	const compound = parseHtml('<h1>Freitagsprogramm</h1><div class="bodyTxt"><h2>x</h2></div>');
	assert.equal(p['extractDayName'](compound), 'Samstag');
	const korean = parseHtml('<h1>금요일들</h1><div class="bodyTxt"><h2>x</h2></div>');
	assert.equal(p['extractDayName'](korean), 'Samstag');
});

test('dayOrder sorts the Korean days like every other language', () => {
	const p = parser();
	assert.deepEqual(
		['일요일', '금요일', '토요일'].sort((a, b) => p['dayOrder'](a) - p['dayOrder'](b)),
		['금요일', '토요일', '일요일'],
	);
});

// ── Korean (fictional titles; the markers are as the real files print them) ─

test('parseLi strips Korean talk markers from the title', () => {
	// Missing from the generic talk pattern, these would still parse as talks
	// — with the marker left at the front of the title and the file name.
	const p = parser();
	for (const marker of ['사회자 연설:', '성경 공개 강연:']) {
		const dom = parseHtml(`
			<ul><li>
				<p>9:40 <span class="du-color--gold"><strong>${marker}</strong></span> 예시 제목 (<a href="jwpub://b/NWTR/19:16:11-19:16:11">시 16:11</a>)</p>
			</li></ul>
		`);
		const item = p['parseLi'](dom.querySelector('li'));
		assert.equal(item.itemType, 'talk');
		assert.equal(item.title, '예시 제목', `marker "${marker}" must be stripped`);
	}
});

test('detectItemType recognises the Korean drama, symposium and baptism markers', () => {
	const p = parser();
	const typeOf = marker => p['detectItemType'](
		parseHtml(`<ul><li><p><strong>${marker}</strong> 예시</p></li></ul>`).querySelector('li'),
	)[0];
	assert.equal(typeOf('성경 드라마:'), 'bible-drama');
	assert.equal(typeOf('심포지엄:'), 'talk-series');
	// Carries the generic talk word 연설 too, so it must be caught first.
	assert.equal(typeOf('침례 연설:'), 'baptism');
});

test('extractQuestionsDocument matches the Korean heading once it is cleaned', () => {
	const p = parser();
	p['lang'] = 'ko';
	const body = '<div class="bodyTxt"><ul class="source"><li><p>1. 예시 질문?</p></li></ul></div>';
	// As the file prints it: two U+200B inside the heading.
	const raw = '<header><h1>아래 질문\u200b에 대한 답\u200b을 찾아 보십시오</h1></header>' + body;
	assert.equal(p['extractQuestionsDocument'](parseHtml(raw)), null, 'uncleaned, it must not match');
	const item = p['extractQuestionsDocument'](parseHtml(p['clean'](raw)));
	assert.ok(item, 'cleaned, it must match');
	assert.equal(item.title, '아래 질문에 대한 답을 찾아 보십시오');
});

test('clean removes zero-width spaces in every language', () => {
	// English files carry a few, before dashes, two of them inside item titles;
	// util/legacyNames.ts lets an update find the notes named with them.
	const p = parser();
	p['lang'] = 'ko';
	assert.equal(p['clean']('노래 89\u200b번'), '노래 89번');
	p['lang'] = 'en';
	assert.equal(p['clean']('Forever\u200b—Is It Realistic?'), 'Forever—Is It Realistic?');
});

test('extractDayTheme drops a citation appended after a dash', () => {
	// English, Portuguese and Korean write "…”—Matthew 5:3" rather than
	// "(Matthew 5:3)"; the overview used to print the reference twice.
	for (const [text, link] of [['“Glückliche Probe”—Testbuch 5:3', 'Testbuch 5:3'], ['“Probe.” — Testbuch 5:3.', 'Testbuch 5:3'], ['“예시”—마태복음 5:3', '마태복음 5:3']]) {
		const visible = text.replace(link, `<a href="jwpub://b/NWTR/40:5:3-40:5:3">${link}</a>`);
		const { theme } = parser()['extractDayTheme'](parseHtml(`<header></header><p>${visible}</p>`));
		assert.ok(!theme.includes('5:3'), theme);
	}
});

test('extractDayTheme keeps a reference that is part of the sentence', () => {
	const { theme } = parser()['extractDayTheme'](parseHtml('<header></header><p>Lies <a href="jwpub://b/NWTR/40:5:3-40:5:3">Testbuch 5:3</a></p>'));
	assert.equal(theme, 'Lies Testbuch 5:3');
});
