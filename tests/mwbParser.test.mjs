/**
 * Unit tests for MwbParser's HTML-parsing helpers. Uses hand-written,
 * fictional markup shaped like the real meeting-workbook jwpub HTML
 * structure — never actual "Leben und Dienst" text, to keep copyrighted
 * content out of the repo (same policy as jwpubParser.test.mjs).
 *
 * Private methods are reached via bracket-notation (TypeScript's `private`
 * is compile-time only) — the same technique jwpubParser.test.mjs uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { MwbParser, MEMORIAL_READING_TITLE_RE } = await jiti.import('../src/parser/MwbParser.ts');
const { NL } = await jiti.import('../src/i18n.ts');

function parser() {
	return new MwbParser(new Uint8Array());
}

function parseHtml(html) {
	return new DOMParser().parseFromString(html, 'text/html');
}

// A full, fictional week document exercising every structural quirk real
// files show: item 1 of a section wrapped together with its own content
// (the real markup's oddity — every other item's heading is a plain
// top-level sibling followed by separate content divs), a sub-question list
// with screen-reader-only "Deine Antwort" labels and <textarea> answer
// placeholders that must be stripped, two different assignment-type labels,
// and the always-last "Versammlungsbibelstudium" item.
const WEEK_HTML = `
<header>
<h1>Testwoche 1.-7. Januar</h1>
<h2><a href="jwpub://b/NWTR/20:16:20-20:16:20">Testbuch 16</a></h2>
</header>
<div class="bodyTxt">
<h3 class="dc-icon--music"><a href="jwpub://p/X:1102016800/"><strong>Lied 1</strong></a> <strong>und Gebet | Einleitende Worte</strong> <span>(1 Min.)</span></h3>
<div id="w1"><h2><strong>SCHÄTZE AUS GOTTES WORT</strong></h2></div>
<div id="w2">
<h3><strong>1. Testtitel eins</strong></h3>
<div><div><p>(10 Min.)</p></div>
<p>Testinhalt mit Bibelstelle (<a href="jwpub://b/NWTR/20:16:20-20:16:20">Testbuch 16:20</a>).</p>
</div>
</div>
<h3><strong>2. Nach geistigen Testschätzen graben</strong></h3>
<div><div><p>(10 Min.)</p></div>
<ul class="du-listStyleType--none"><li><p><a href="jwpub://b/NWTR/20:21:1-20:21:1">Testbuch 21:1</a> – Testfrage?</p>
<div class="gen-field"><label class="dc-screenReaderText">Deine Antwort</label><textarea>geheimer Text</textarea></div>
</li>
<li><p>Was hast du beim Testlesen entdeckt?</p>
<div class="gen-field"><label class="dc-screenReaderText">Deine Antwort</label><textarea></textarea></div>
</li></ul>
</div>
<div><h2><strong>UNS IM DIENST VERBESSERN</strong></h2></div>
<h3><strong>3. Gespräche beginnen</strong></h3>
<div><p>(3 Min.) VON HAUS ZU HAUS. Testinhalt. (<a class="xt" href="jwpub://p/X:9999999/">tb Lektion 1</a>)</p></div>
<h3><strong>4. Interesse fördern</strong></h3>
<div><p>(2 Min.) INFORMELL. Testinhalt zwei.</p></div>
<div><h2><strong>UNSER LEBEN ALS CHRIST</strong></h2></div>
<h3 class="dc-icon--music"><a href="jwpub://p/X:1102016801/"><strong>Lied 2</strong></a></h3>
<h3><strong>5. Testabschnitt fünf</strong></h3>
<div><p>(15 Min.) Testinhalt drei.</p></div>
<h3><strong>6. Versammlungsbibelstudium</strong></h3>
<div><p>(30 Min.) <a class="xt" href="jwpub://p/X:8888888/">tb2 Geschichte 1</a></p></div>
<h3><strong>Schlussworte</strong> <span>(3 Min.)</span> <strong>|</strong> <span class="dc-icon--music"><a href="jwpub://p/X:1102016802/"><strong>Lied 3</strong></a></span> <strong>und Gebet</strong></h3>
</div>
`;

test('parseWeekDocument extracts the date range and weekly Bible reading', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	assert.equal(week.dateRangeLabel, 'Testwoche 1.-7. Januar');
	assert.equal(week.bibleReadingLabel, 'Testbuch 16');
	assert.deepEqual(week.bibleReading, [{ book: 20, chapter: 16, verseStart: 20, verseEnd: 20 }]);
});

test('parseWeekDocument classifies the 3 song headings positionally (opening/mid-week/closing)', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	assert.deepEqual(week.openingSong, { songNumber: 1, songDocid: 1102016800, includesPrayer: true, includesIntroWords: true });
	assert.deepEqual(week.midWeekSong, { songNumber: 2, songDocid: 1102016801, includesPrayer: undefined, includesIntroWords: undefined });
	assert.deepEqual(week.closingSong, { songNumber: 3, songDocid: 1102016802, includesPrayer: true, includesIntroWords: undefined });
});

test('parseWeekDocument numbers items sequentially across all 3 sections, not restarted per section', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	assert.equal(week.items.length, 6);
	assert.deepEqual(week.items.map(i => i.number), [1, 2, 3, 4, 5, 6]);
	assert.deepEqual(week.items.map(i => i.section), ['treasures', 'treasures', 'ministry', 'ministry', 'living', 'living']);
});

test('parseWeekDocument extracts item 1 correctly even though its <h3> is wrapped together with its own content (real markup quirk)', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item1 = week.items[0];
	assert.equal(item1.title, 'Testtitel eins');
	assert.equal(item1.durationMin, 10);
	// The standalone "(10 Min.)" paragraph is excluded from `paragraphs` (already
	// surfaced via durationMin) — only the real descriptive-text paragraph remains,
	// with its embedded scripture reference as its own segment.
	assert.equal(item1.paragraphs.length, 1);
	assert.deepEqual(item1.paragraphs[0], [
		{ type: 'text', markdown: 'Testinhalt mit Bibelstelle (' },
		{ type: 'scripture', scripture: { book: 20, chapter: 16, verseStart: 20, verseEnd: 20 } },
		{ type: 'text', markdown: ').' },
	]);
});

// Flattens a question's segments into plain text for content assertions —
// mirrors what MwbNoteBuilder.renderSegments() would show for a text-only
// segment list (scripture/citation segments aren't expected in these cases).
function flatten(segments) {
	return segments.map(s => s.markdown ?? s.label ?? '').join('');
}

test('parseWeekDocument strips <textarea> and screen-reader-only labels from sub-questions', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item2 = week.items[1];
	assert.equal(item2.subQuestions.length, 2);
	for (const q of item2.subQuestions) {
		const text = flatten(q);
		assert.ok(!text.includes('Deine Antwort'), 'screen-reader-only label must be stripped');
		assert.ok(!text.includes('geheimer Text'), 'textarea placeholder content must be stripped');
	}
	assert.ok(flatten(item2.subQuestions[0]).includes('Testfrage?'));
});

test('sub-questions render an embedded scripture reference as its own clickable segment, not plain text', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item2 = week.items[1];
	const firstQuestion = item2.subQuestions[0];
	assert.ok(firstQuestion.some(s => s.type === 'scripture'), 'the scripture reference inside the sub-question must be its own segment');
});

test('parseWeekDocument captures the assignment-type label verbatim as metadata, and the duration', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item3 = week.items[2];
	assert.equal(item3.assignmentType, 'VON HAUS ZU HAUS');
	assert.equal(item3.durationMin, 3);

	const item4 = week.items[3];
	assert.equal(item4.assignmentType, 'INFORMELL');
	assert.equal(item4.durationMin, 2);
});

test('parseWeekDocument strips the leading duration marker from the rendered paragraph text and bolds the assignment-type prefix in place, instead of duplicating both', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item3 = week.items[2];
	assert.equal(item3.paragraphs.length, 1);
	const firstSegment = item3.paragraphs[0][0];
	assert.equal(firstSegment.type, 'text');
	assert.ok(!firstSegment.markdown.includes('(3 Min.)'), 'duration marker must not remain in the paragraph text');
	assert.ok(firstSegment.markdown.startsWith('**VON HAUS ZU HAUS.**'), 'assignment-type prefix must be bolded in place');
});

test('parseWeekDocument turns a source-material citation link into its own "citation" segment carrying the real jw.org docid', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item3 = week.items[2];
	const citation = item3.paragraphs[0].find(seg => seg.type === 'citation');
	assert.ok(citation, 'a citation segment must be present');
	assert.equal(citation.label, 'tb Lektion 1');
	assert.equal(citation.docid, 9999999);
});

test('renderParagraphSegments preserves a plain https:// link (e.g. a "Zeig das VIDEO" prompt) as a real markdown link baked into the text', () => {
	const dom = parseHtml('<p>Schau dir <a href="https://www.jw.org/finder?lank=pub-ljf_1_VIDEO"><strong>das VIDEO</strong></a> an.</p>');
	const p = dom.querySelector('p');
	const segments = parser()['renderParagraphSegments'](p);
	assert.equal(segments.length, 1);
	assert.deepEqual(segments[0], {
		type: 'text',
		markdown: 'Schau dir [**das VIDEO**](https://www.jw.org/finder?lank=pub-ljf_1_VIDEO) an.',
	});
});

test('extractParagraphs excludes a photo\'s legal image-source credit (<p class="imgCredit">) but keeps the figcaption\'s own descriptive text', () => {
	const dom = parseHtml(`
		<div>
		<p>Besprechung.</p>
		<div id="f1"><figure>
		<img src="jwpub-media://test.jpg" alt="Testbild" />
		<p class="imgCredit">Based on NASA/Visible Earth imagery</p>
		<figcaption class="figcaption"><p>Eine echte Bildunterschrift mit Lehrinhalt</p></figcaption>
		</figure></div>
		</div>
	`);
	const paragraphs = parser()['extractParagraphs']([dom.querySelector('div')]);
	const allText = paragraphs.map(p => p.map(s => s.markdown ?? '').join('')).join(' | ');
	assert.ok(!allText.includes('NASA'), 'image credit must be excluded');
	assert.ok(allText.includes('Eine echte Bildunterschrift mit Lehrinhalt'), 'figcaption text must still be kept');
});

test('parseWeekDocument flags the last "living"-section item as the Congregation Bible Study via its title', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const cbs = week.items[5];
	assert.equal(cbs.title, 'Versammlungsbibelstudium');
	assert.equal(cbs.isCongregationBibleStudy, true);
	assert.equal(cbs.durationMin, 30);
	const citation = cbs.paragraphs[0].find(seg => seg.type === 'citation');
	assert.equal(citation.label, 'tb2 Geschichte 1');
	assert.equal(citation.docid, 8888888);
	assert.ok(!week.items[4].isCongregationBibleStudy);
});

test('parseWeekDocument falls back to positional Congregation Bible Study detection when the title does not match', () => {
	const dom = parseHtml(WEEK_HTML.replace('6. Versammlungsbibelstudium', '6. Ein anderer Titel'));
	const week = parser()['parseWeekDocument'](dom);
	assert.equal(week.items[5].isCongregationBibleStudy, true);
});

test('parseWeekDocument returns null when the document has no <h1>', () => {
	const dom = parseHtml('<div class="bodyTxt"></div>');
	assert.equal(parser()['parseWeekDocument'](dom), null);
});

test('parseWeekDocument returns null when no numbered items are found at all', () => {
	const dom = parseHtml('<header><h1>Leere Woche</h1></header><div class="bodyTxt"></div>');
	assert.equal(parser()['parseWeekDocument'](dom), null);
});

test('classifySongHeadings degrades gracefully to opening+closing only when a week has 2 song headings instead of 3', () => {
	const dom = parseHtml(WEEK_HTML.replace('<h3 class="dc-icon--music"><a href="jwpub://p/X:1102016801/"><strong>Lied 2</strong></a></h3>', ''));
	const week = parser()['parseWeekDocument'](dom);
	assert.equal(week.openingSong.songNumber, 1);
	assert.equal(week.closingSong.songNumber, 3);
	assert.equal(week.midWeekSong, undefined);
});

test('classifySongHeadings rejects a week with an unexpected song-heading count (not 2 or 3)', () => {
	// Remove BOTH the mid-week and closing song headings — leaves only 1.
	const html = WEEK_HTML
		.replace('<h3 class="dc-icon--music"><a href="jwpub://p/X:1102016801/"><strong>Lied 2</strong></a></h3>', '')
		.replace('<h3><strong>Schlussworte</strong> <span>(3 Min.)</span> <strong>|</strong> <span class="dc-icon--music"><a href="jwpub://p/X:1102016802/"><strong>Lied 3</strong></a></span> <strong>und Gebet</strong></h3>', '');
	const dom = parseHtml(html);
	assert.equal(parser()['parseWeekDocument'](dom), null);
});

// ── Memorial Bible-reading-schedule document ────────────────────────────────

const MEMORIAL_HTML = `
<header>
<h1>Testleseprogramm für das Testfest</h1>
<div><p>Einleitungstext für den Test.</p></div>
</header>
<div class="bodyTxt">
<h2>TESTTAG, 1. TESTMONAT</h2>
<div class="gen-field"><input type="checkbox"/><label><a href="jwpub://b/NWTR/43:11:55-43:12:1">Testbuch 11:55-12:1</a></label></div>
<h2>TESTTAG, 2. TESTMONAT</h2>
<div class="gen-field"><input type="checkbox"/><label><a href="jwpub://b/NWTR/40:26:6-40:26:13">Testbuch 26:6-13</a></label></div>
<p><a class="xt" href="jwpub://p/X:1102014701/">Testquelle, Kap. 1</a></p>
</div>
`;

test('parseMemorialReadingDocument groups readings under each day heading', () => {
	const dom = parseHtml(MEMORIAL_HTML);
	const schedule = parser()['parseMemorialReadingDocument'](dom, 'Testleseprogramm für das Testfest');
	assert.equal(schedule.title, 'Testleseprogramm für das Testfest');
	assert.equal(schedule.intro, 'Einleitungstext für den Test.');
	assert.equal(schedule.days.length, 2);
	assert.equal(schedule.days[0].dayLabel, 'TESTTAG, 1. TESTMONAT');
	assert.deepEqual(schedule.days[0].readings, [{ scripture: { book: 43, chapter: 11, verseStart: 55, verseEnd: 1, chapterEnd: 12 } }]);
});

test('parseMemorialReadingDocument attaches a trailing source-citation link to the day\'s last reading', () => {
	const dom = parseHtml(MEMORIAL_HTML);
	const schedule = parser()['parseMemorialReadingDocument'](dom, 'Testleseprogramm für das Testfest');
	assert.equal(schedule.days[1].readings[0].sourceCitation, 'Testquelle, Kap. 1');
});

test('parseMemorialReadingDocument returns null when no day headings are found', () => {
	const dom = parseHtml('<header><h1>Titel</h1></header><div class="bodyTxt"></div>');
	assert.equal(parser()['parseMemorialReadingDocument'](dom, 'Titel'), null);
});

// ── Spacing at link boundaries ──────────────────────────────────────────────

test('renderParagraphSegments keeps the space on either side of a link', () => {
	// Every text run used to be trimmed at each link, so "13; w18.06" came out
	// as "13;w18.06" — 86 of the 91 paragraphs with links in a real issue.
	const p = parseHtml(`<p>Ein Satz (<a href="jwpub://b/NWTR/23:17:12-23:17:13">Jes 17:12, 13</a>; <a class="xt" href="jwpub://p/X:2018406/7">w18.06 7</a>) und weiter.</p>`).querySelector('p');
	const segments = parser()['renderParagraphSegments'](p);
	assert.deepEqual(segments.map(s => s.type === 'text' ? s.markdown : `<${s.type}>`), ['Ein Satz (', '<scripture>', '; ', '<citation>', ') und weiter.']);
});

test('renderParagraphSegments still trims the paragraph\u2019s own two ends', () => {
	const p = parseHtml(`<p>  Anfang <a class="xt" href="jwpub://p/X:1/">Quelle</a>  </p>`).querySelector('p');
	const segments = parser()['renderParagraphSegments'](p);
	assert.equal(segments[0].markdown, 'Anfang ');
	assert.equal(segments.length, 2, 'a trailing run of nothing but space is dropped');
});

// ── Korean (fictional titles; structure words as the real files print them) ─

function koreanParser() {
	const p = parser();
	p['lang'] = 'ko';
	return p;
}

const KOREAN_WEEK_HTML = `
<header><h1>1월 5-11일</h1><h2><a href="jwpub://b/NWTR/23:17:1-23:20:6">이사야 17-20장</a></h2></header>
<div class="bodyTxt">
<h3><a href="jwpub://p/KO:1102022953/"><strong>노래 153</strong></a> <strong>및 기도 | 소개말</strong> (1분)</h3>
<h2>성경에 담긴 보물</h2>
<h3>1. 예시 제목</h3><p>(10분)</p>
<h2>야외 봉사에 힘쓰십시오</h2>
<h3>2. 대화 시작하기</h3><p>(3분) 호별 방문. 예시 문장.</p>
<h3>3. 관심이 자라도록 돕기</h3><p>(4분) 비공식 증거. 예시 문장.</p>
<h3>4. 제자 삼기</h3><p>(5분) 공개 증거. 예시 문장.</p>
<h3>5. 연설</h3><p>(5분) 실연. 예시 문장.</p>
<h2>그리스도인 생활</h2>
<h3><a href="jwpub://p/KO:1102016948/"><strong>노래 148</strong></a></h3>
<h3>6. 예시 토의</h3><p>(10분) 토의.</p>
<h3>7. 회중 성서 연구</h3><p>(30분) 예시.</p>
<h3>맺음말 (3분) | <a href="jwpub://p/KO:1102016873/"><strong>노래 73</strong></a> 및 기도</h3>
</div>`;

test('a Korean week is split into the three sections by their own headings', () => {
	const week = koreanParser()['parseWeekDocument'](parseHtml(KOREAN_WEEK_HTML));
	assert.deepEqual(week.items.map(i => i.section), ['treasures', 'ministry', 'ministry', 'ministry', 'ministry', 'living', 'living']);
	assert.equal(week.dateRangeLabel, '1월 5-11일');
});

test('a Korean duration is read from "(N분)" and cut from the text', () => {
	const week = koreanParser()['parseWeekDocument'](parseHtml(KOREAN_WEEK_HTML));
	assert.deepEqual(week.items.map(i => i.durationMin), [10, 3, 4, 5, 5, 10, 30]);
	assert.ok(!week.items[1].paragraphs[0][0].markdown.includes('분)'));
});

test('the three Korean assignment types are recognised, and nothing else of that shape', () => {
	// 실연 (demonstration) and 토의 (discussion) sit in the same position and
	// are not assignment types — German leaves their counterparts alone too.
	const week = koreanParser()['parseWeekDocument'](parseHtml(KOREAN_WEEK_HTML));
	assert.deepEqual(week.items.map(i => i.assignmentType), [undefined, '호별 방문', '비공식 증거', '공개 증거', undefined, undefined, undefined]);
	assert.equal(week.items[1].paragraphs[0][0].markdown, '**호별 방문.** 예시 문장.');
});

test('the Korean Congregation Bible Study is found by its title', () => {
	const week = koreanParser()['parseWeekDocument'](parseHtml(KOREAN_WEEK_HTML));
	assert.equal(week.items[6].isCongregationBibleStudy, true);
	assert.equal(week.items.filter(i => i.isCongregationBibleStudy).length, 1);
});

test('Korean song headings carry prayer and introduction like German ones', () => {
	const week = koreanParser()['parseWeekDocument'](parseHtml(KOREAN_WEEK_HTML));
	assert.equal(week.openingSong.songNumber, 153);
	assert.equal(week.openingSong.includesPrayer, true);
	assert.equal(week.openingSong.includesIntroWords, true);
	assert.equal(week.midWeekSong.includesPrayer, undefined);
	assert.equal(week.closingSong.includesPrayer, true);
});

test('a workbook file has its zero-width spaces removed before parsing, in every language', () => {
	assert.equal(koreanParser()['clean']('성경\u200b에 담긴 보물'), '성경에 담긴 보물');
	assert.equal(parser()['clean']('Text\u200bmit'), 'Textmit');
});

// ── The other six languages (fictional text; structure words as the
// January-February and March-April 2026 issues print them) ──────────────────

function parserFor(lang) {
	const p = parser();
	p['lang'] = lang;
	return p;
}

function paragraph(text) {
	return parseHtml(`<p>${text}</p>`).querySelector('p');
}

test('every language\u2019s duration marker is read, as its own issue prints it', () => {
	const cases = [['(10 Min.)', 10], ['(10 min.)', 10], ['(10 min)', 10], ['(10 mins.)', 10], ['(1 min.)', 1], ['(10 мин.)', 10], ['(10분)', 10]];
	for (const [marker, minutes] of cases) {
		assert.equal(parser()['extractDuration']([paragraph(`${marker} Text.`)]), minutes, marker);
	}
	assert.equal(parser()['extractDuration']([paragraph('(Isa 17:12; w18.06 7 ¶16)')]), undefined);
});

test('a French period right behind the duration bracket goes with it', () => {
	// "(10 min). Discussion." — German never closes the sentence there.
	const paragraphs = [[{ type: 'text', markdown: '(10 min). Discussion. Texte.' }]];
	parser()['stripLeadingMetadataText'](paragraphs, 10, undefined);
	assert.equal(paragraphs[0][0].markdown, 'Discussion. Texte.');
});

test('an assignment label is read in capitals of any script, with or without its period', () => {
	const cases = [
		['en', '(3 min.) HOUSE TO HOUSE. Text.', 'HOUSE TO HOUSE'],
		['fr', '(4 min) DE MAISON EN MAISON (lmd leçon 5 idée 5).', 'DE MAISON EN MAISON'],
		['fr', '(4 min) TÉMOIGNAGE INFORMEL. Texte.', 'TÉMOIGNAGE INFORMEL'],
		['ru', '(3 мин.) ПРОПОВЕДЬ ПО ДОМАМ. Текст.', 'ПРОПОВЕДЬ ПО ДОМАМ'],
		['ru', '(4 мин.) НЕФОРМАЛЬНОЕ СЛУЖЕНИЕ (lmd урок 3, пункт 5).', 'НЕФОРМАЛЬНОЕ СЛУЖЕНИЕ'],
		['es', '(1 min.) PREDICACIÓN INFORMAL. Texto.', 'PREDICACIÓN INFORMAL'],
		['pt', '(4 min.) TESTEMUNHO PÚBLICO. Texto.', 'TESTEMUNHO PÚBLICO'],
	];
	for (const [lang, text, label] of cases) {
		assert.equal(parserFor(lang)['extractAssignmentType']([paragraph(text)]), label, text);
	}
	assert.equal(parserFor('fr')['extractAssignmentType']([paragraph('(5 min). Discussion.')]), undefined);
});

test('the bold label keeps its period only where the file has one', () => {
	const without = [[{ type: 'text', markdown: '(4 min) DE MAISON EN MAISON (lmd leçon 5 idée 5).' }]];
	parserFor('fr')['stripLeadingMetadataText'](without, 4, 'DE MAISON EN MAISON');
	assert.equal(without[0][0].markdown, '**DE MAISON EN MAISON** (lmd leçon 5 idée 5).');
	const withPeriod = [[{ type: 'text', markdown: '(3 min.) HOUSE TO HOUSE. Text.' }]];
	parserFor('en')['stripLeadingMetadataText'](withPeriod, 3, 'HOUSE TO HOUSE');
	assert.equal(withPeriod[0][0].markdown, '**HOUSE TO HOUSE.** Text.');
});

const RUSSIAN_WEEK_HTML = `
<header><h1>5—11 ЯНВАРЯ</h1><h2><a href="jwpub://b/NWTR/23:17:1-23:20:6">ИСАЙЯ 17—20</a></h2></header>
<div class="bodyTxt">
<h3><a href="jwpub://p/U:1102016953/"><strong>Песня 153</strong></a> <strong>и молитва | Вступительные слова</strong> (1 мин.)</h3>
<h2>СОКРОВИЩА ИЗ СЛОВА БОГА</h2>
<h3>1. Пример</h3><p>(10 мин.) Текст.</p><p>ОПРЕДЕЛЕНИЕ. Текст рамки.</p>
<h2>ОТТАЧИВАЕМ НАВЫКИ СЛУЖЕНИЯ</h2>
<h3>2. Начинайте разговор</h3><p>(3 мин.) ПРОПОВЕДЬ ПО ДОМАМ. Текст.</p>
<h2>ХРИСТИАНСКАЯ ЖИЗНЬ</h2>
<h3><a href="jwpub://p/U:1102016948/"><strong>Песня 148</strong></a></h3>
<h3>3. Изучение Библии в собрании</h3><p>(30 мин.) Пример.</p>
<h3>Заключительные слова (3 мин.) | <a href="jwpub://p/U:1102016873/"><strong>Песня 73</strong></a> и молитва</h3>
</div>`;

test('only ministry items carry an assignment type', () => {
	// The Russian March 2026 issue opens a box in a Treasures item with
	// "ОПРЕДЕЛЕНИЕ." (definition) — capitals, a period, and no assignment.
	const week = parserFor('ru')['parseWeekDocument'](parseHtml(RUSSIAN_WEEK_HTML));
	assert.deepEqual(week.items.map(i => i.section), ['treasures', 'ministry', 'living']);
	assert.deepEqual(week.items.map(i => i.assignmentType), [undefined, 'ПРОПОВЕДЬ ПО ДОМАМ', undefined]);
	assert.equal(week.items[2].isCongregationBibleStudy, true);
	assert.equal(week.openingSong.includesPrayer, true);
	assert.equal(week.openingSong.includesIntroWords, true);
	assert.equal(week.closingSong.includesPrayer, true);
});

test('every language\u2019s section headings and study title are recognised', () => {
	for (const lang of ['de', 'en', 'fr', 'it', 'pt', 'ru', 'es', 'ko']) {
		const p = parserFor(lang);
		const t = NL[lang];
		assert.deepEqual([t.treasuresLabel, t.ministryLabel, t.livingLabel].map(h => p['matchSection'](h)), ['treasures', 'ministry', 'living'], lang);
		assert.equal(p['cleanText'](t.cbsLabel).toUpperCase(), t.cbsLabel.toUpperCase(), lang);
	}
});

test('song headings carry prayer and introduction in every language', () => {
	const headings = {
		en: 'and Prayer | Opening Comments', fr: 'et prière | Paroles d’introduction', it: 'e preghiera | Commenti introduttivi',
		pt: 'e oração | Comentários iniciais', ru: 'и молитва | Вступительные слова', es: 'y oración | Palabras de introducción',
	};
	for (const [lang, rest] of Object.entries(headings)) {
		const h3 = parseHtml(`<h3><a href="jwpub://p/E:1102016953/">X 153</a> ${rest} (1 min)</h3>`).querySelector('h3');
		const song = parserFor(lang)['parseSongHeading'](h3);
		assert.equal(song.includesPrayer, true, lang);
		assert.equal(song.includesIntroWords, true, lang);
	}
});

test('the Memorial reading schedule is recognised by each language\u2019s own title', () => {
	for (const title of ['Bibelleseprogramm für das Gedächtnismahl 2026', '2026 Memorial Bible Reading Schedule', 'Mémorial 2026 : programme de lecture biblique',
		'Lettura della Bibbia per la Commemorazione del 2026', 'Programa de Leitura da Bíblia para o Memorial de 2026',
		'График чтения Библии в период Вечери в 2026 году', 'Lectura bíblica para la Conmemoración del 2026', '2026 기념식 성서 읽기 계획표']) {
		assert.match(title, MEMORIAL_READING_TITLE_RE);
	}
	assert.doesNotMatch('March 2-8', MEMORIAL_READING_TITLE_RE);
});
