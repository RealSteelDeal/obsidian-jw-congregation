import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { NoteBuilder } = await jiti.import('../src/builder/NoteBuilder.ts');

function builder(opts = {}) {
	return new NoteBuilder({
		scriptureLinks: true,
		reviewNote: false,
		showTagField: true,
		showTimeField: true,
		showScriptureField: true,
		showSpeakerField: true,
		extraFields: '',
		...opts,
	});
}

function coItem(overrides = {}) {
	return {
		time: '9:40',
		itemType: 'talk',
		title: 'Ist ewiges Glück möglich?',
		scriptures: [{ book: 19, chapter: 16, verseStart: 11 }],
		bulletPoints: [],
		...overrides,
	};
}

function coDay(overrides = {}) {
	return {
		name: 'Samstag',
		weekday: 'Samstag',
		theme: '„Geben macht glücklicher als Empfangen“',
		themeScripture: { book: 44, chapter: 20, verseStart: 35 },
		sessions: [{ name: 'Vormittag', items: [coItem()] }],
		...overrides,
	};
}

function coCongress(days) {
	return { type: 'CO', theme: 'Ewiges Glück', year: 2026, days, lang: 'de' };
}

test('congressFolderName formats each congress type', () => {
	const b = builder();
	assert.equal(
		b.congressFolderName({ type: 'CO', theme: 'Ewiges Glück', year: 2026, days: [], lang: 'de' }),
		'Regionaler Kongress 2026 – Ewiges Glück',
	);
	assert.equal(
		b.congressFolderName({ type: 'CA-copgm', theme: 'Titel', year: 2027, days: [], lang: 'de' }),
		'Kreiskongressprogramm 2026-2027 – mit dem Kreisaufseher – „Titel“',
	);
});

test('overview note renders the weekday as a top-level heading, above the sessions', () => {
	const result = builder().buildNotes(coCongress([coDay()]));
	const overview = result.notes.find(n => n.filename === '00. Übersicht.md');
	const lines = overview.content.split('\n');
	assert.equal(lines[0], '# Samstag');
	assert.ok(!overview.content.includes('**Tag:**'), 'old "Tag:" prefix should be gone');
});

test('overview note shows the day theme quote with its linked scripture in parentheses', () => {
	const result = builder().buildNotes(coCongress([coDay()]));
	const overview = result.notes.find(n => n.filename === '00. Übersicht.md');
	assert.ok(
		overview.content.includes(
			'„Geben macht glücklicher als Empfangen“ ([Apostelgeschichte 20:35](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=44020035&pub=nwtsty))',
		),
	);
});

test('overview note omits the theme line entirely when a day has none', () => {
	const result = builder().buildNotes(coCongress([coDay({ theme: undefined, themeScripture: undefined })]));
	const overview = result.notes.find(n => n.filename === '00. Übersicht.md');
	assert.ok(!overview.content.includes('„'));
});

test('overview scripture references are wrapped in one parenthesis, semicolon-separated', () => {
	const item = coItem({
		scriptures: [
			{ book: 40, chapter: 5, verseStart: 1, verseEnd: 2 },
			{ book: 19, chapter: 100, verseStart: 2 },
		],
	});
	const result = builder().buildNotes(coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [item] }] })]));
	const overview = result.notes.find(n => n.filename === '00. Übersicht.md');
	assert.ok(overview.content.includes(
		'(<a href="jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=40005001-40005002&pub=nwtsty">Matthäus 5:1, 2</a>; ' +
		'<a href="jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19100002&pub=nwtsty">Psalm 100:2</a>)',
	));
});

test('note "Bibeltexte:" block wraps scriptures in one parenthesis with a label', () => {
	const item = coItem({
		scriptures: [
			{ book: 19, chapter: 16, verseStart: 11 },
			{ book: 19, chapter: 100, verseStart: 2 },
		],
	});
	const result = builder().buildNotes(coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [item] }] })]));
	const itemNote = result.notes.find(n => n.filename !== '00. Übersicht.md');
	assert.ok(itemNote.content.includes(
		'**Bibeltexte:** ([Psalm 16:11](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19016011&pub=nwtsty); ' +
		'[Psalm 100:2](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19100002&pub=nwtsty))',
	));
});

test('scriptureLinks: false renders plain text instead of markdown links', () => {
	const item = coItem({ scriptures: [{ book: 19, chapter: 16, verseStart: 11 }] });
	const result = builder({ scriptureLinks: false }).buildNotes(
		coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [item] }] })]),
	);
	const itemNote = result.notes.find(n => n.filename !== '00. Übersicht.md');
	assert.ok(itemNote.content.includes('**Bibeltexte:** (Psalm 16:11)'));
});

test('song link uses the real songDocid from the source file when available', () => {
	const item = coItem({
		itemType: 'song', title: 'Lied 160', scriptures: [], songNumber: 160, songDocid: 1102022960,
	});
	const result = builder().buildNotes(coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [item] }] })]));
	const overview = result.notes.find(n => n.filename === '00. Übersicht.md');
	// Real docid (1102022960), NOT the naive songNumber-based formula (which would predict 1102016960).
	assert.ok(overview.content.includes(
		'[Lied 160](https://www.jw.org/finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102022960)',
	));
});

test('song link falls back to the songNumber formula when no songDocid is available (RTF import)', () => {
	const item = coItem({ itemType: 'song', title: 'Lied 14', scriptures: [], songNumber: 14 });
	const result = builder().buildNotes(coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [item] }] })]));
	const overview = result.notes.find(n => n.filename === '00. Übersicht.md');
	assert.ok(overview.content.includes(
		'[Lied 14](https://www.jw.org/finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102016814)',
	));
});

test('review note starts with the italic type-specific "Hinweis" and has no duplicate heading', () => {
	// Regional convention: video hint on the very first line. No "#" heading —
	// Obsidian already shows the filename as the note title, so one in the note
	// body rendered as a duplicate second title.
	const co = builder({ reviewNote: true }).buildNotes(coCongress([coDay()]));
	const coReview = co.notes.find(n => n.filename === 'Wiederholung.md');
	const coLines = coReview.content.split('\n');
	assert.equal(
		coLines[0],
		'*Hinweis: Bei der Kongress-Wiederholung für den regionalen Kongress wird der Bruder beim Programmpunkt das Video mit Auszügen aus dem Kongressprogramm abspielen.*',
	);
	assert.ok(!coReview.content.includes('# Kongress-Wiederholung'));
	assert.ok(coLines.indexOf('**Welche Gedanken haben dich Jehova nähergebracht?**') > 0);

	// Circuit assembly: printed-questions hint with the link, same slot.
	const questions = coItem({ title: 'Beantworte die folgenden Fragen', scriptures: [] });
	const ca = builder({ reviewNote: true }).buildNotes({
		type: 'CA-copgm', theme: 'Titel', year: 2026, lang: 'de',
		days: [coDay({ sessions: [{ name: 'Vormittag', items: [questions] }] })],
	});
	const caReview = ca.notes.find(n => n.filename === 'Wiederholung.md');
	const caLines = caReview.content.split('\n');
	assert.equal(
		caLines[0],
		'*Hinweis: Der Versammlungsleiter stellt außerdem die gedruckten Wiederholungsfragen: [[01. Beantworte die folgenden Fragen|Beantworte die folgenden Fragen]]*',
	);
	assert.ok(!caReview.content.includes('# Kongress-Wiederholung'));
});

test('per-item note links back to its day\'s overview, on the first content line', () => {
	const result = builder().buildNotes(coCongress([coDay()]));
	const itemNote = result.notes.find(n => n.filename !== '00. Übersicht.md');
	const lines = itemNote.content.split('\n');
	assert.equal(lines[0], '[[Samstag/00. Übersicht|↩ Zur Übersicht]]');
});

test('a song immediately following a programme item is mentioned and linked in that item\'s own note', () => {
	const talk = coItem({ title: 'Ist ewiges Glück möglich?' });
	const song = coItem({
		itemType: 'song', title: 'Lied 12 und Gebet', scriptures: [], songNumber: 12, songDocid: 1102016812,
	});
	const result = builder().buildNotes(
		coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [talk, song] }] })]),
	);
	const itemNote = result.notes.find(n => n.filename !== '00. Übersicht.md');
	assert.ok(itemNote.content.includes(
		'**Anschließend:** [Lied 12](https://www.jw.org/finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102016812) und Gebet',
	));
});

test('the "Anschließend" hint has 3 rendered blank lines above it, after "Redner:"', () => {
	const talk = coItem({ title: 'Ist ewiges Glück möglich?', scriptures: [] });
	const song = coItem({ itemType: 'song', title: 'Lied 12', scriptures: [], songNumber: 12, songDocid: 1102016812 });
	const result = builder().buildNotes(
		coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [talk, song] }] })]),
	);
	const itemNote = result.notes.find(n => n.filename !== '00. Übersicht.md');
	const rednerIndex = itemNote.content.indexOf('**Redner:**');
	const anschliessendIndex = itemNote.content.indexOf('**Anschließend:**');
	const between = itemNote.content.slice(rednerIndex, anschliessendIndex);
	// The gap lines must be a no-break space (escape \u00A0, not truly empty): Markdown collapses runs of
	// blank lines to a single paragraph break in Reading View, so plain empty
	// lines render as no visible gap at all.
	assert.equal(between, '**Redner:**\n\n\u00A0\n\u00A0\n\u00A0\n\n');
});

test('a talk-series note also picks up its trailing song, after the last part', () => {
	const series = coItem({
		itemType: 'talk-series',
		title: 'Symposium',
		parts: [coItem({ title: 'Teil 1' }), coItem({ title: 'Teil 2' })],
	});
	const song = coItem({ itemType: 'song', title: 'Lied 5', scriptures: [], songNumber: 5, songDocid: 1102016805 });
	const result = builder().buildNotes(
		coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [series, song] }] })]),
	);
	const itemNote = result.notes.find(n => n.filename !== '00. Übersicht.md');
	assert.ok(itemNote.content.includes(
		'**Anschließend:** [Lied 5](https://www.jw.org/finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102016805)',
	));
	// The gap must be exactly the 3 no-break-space lines — the series path pushes its
	// writing space as one '\n\n\n' element, which the gap's trim must also
	// swallow (a plain === '' check walked past it, doubling the gap).
	assert.ok(itemNote.content.includes('**Redner:**\n\n\u00A0\n\u00A0\n\u00A0\n\n**Anschließend:**'));
});

test('a regular programme item following another is linked to its note in the "Anschließend" hint', () => {
	const talk1 = coItem({ title: 'Erster Vortrag', scriptures: [] });
	const talk2 = coItem({ title: 'Zweiter Vortrag', scriptures: [] });
	const result = builder().buildNotes(
		coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [talk1, talk2] }] })]),
	);
	const note1 = result.notes.find(n => n.filename === '01. Erster Vortrag.md');
	assert.ok(note1.content.includes('**Anschließend:** [[02. Zweiter Vortrag|Zweiter Vortrag]]'));
	// The last item of a session has nothing following it — no hint.
	const note2 = result.notes.find(n => n.filename === '02. Zweiter Vortrag.md');
	assert.ok(!note2.content.includes('**Anschließend:**'));
});

test('a plain aside (Pause/Musikvideo) immediately following a programme item is mentioned too, not just a trailing song', () => {
	const talk = coItem({ title: 'Ist ewiges Glück möglich?' });
	const pause = coItem({ itemType: 'aside', title: 'Pause (15 Min.)', scriptures: [] });
	const result = builder().buildNotes(
		coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [talk, pause] }] })]),
	);
	const itemNote = result.notes.find(n => n.filename !== '00. Übersicht.md');
	assert.ok(itemNote.content.includes('**Anschließend:** Pause (15 Min.)'));
});

test('cover image is written as a separate Titelbild attachment, not inlined', () => {
	const day = coDay({
		coverImage: { data: new Uint8Array([1, 2, 3]), filename: 'foo.jpg', mimeType: 'image/jpeg' },
	});
	const result = builder().buildNotes(coCongress([day]));
	assert.equal(result.attachments.length, 1);
	assert.equal(result.attachments[0].filename, 'Titelbild.jpg');
	const overview = result.notes.find(n => n.filename === '00. Übersicht.md');
	assert.ok(overview.content.startsWith('![[Titelbild.jpg]]'));
});

// ── English programme files (Congress.lang = 'en') ──────────────────────────

function enCongress(days) {
	return { type: 'CO', theme: 'Eternal Happiness', year: 2026, days, lang: 'en' };
}

function enDay(overrides = {}) {
	return {
		name: 'Saturday',
		weekday: 'Saturday',
		sessions: [{ name: 'Morning', items: [] }],
		...overrides,
	};
}

test('an English congress produces English folder name, filenames and labels', () => {
	const talk = coItem({
		title: 'What Can Prevent Us From Being Happy?',
		scriptures: [{ book: 42, chapter: 6, verseStart: 24, verseEnd: 26 }],
	});
	const song = coItem({ itemType: 'song', title: 'Song No. 89 and Announcements', scriptures: [], songNumber: 89, songDocid: 1102016889 });
	const result = builder({ reviewNote: true }).buildNotes(
		enCongress([enDay({ sessions: [{ name: 'Morning', items: [talk, song] }] })]),
	);

	assert.equal(result.congressFolder, '2026 Regional Convention – Eternal Happiness');

	const overview = result.notes.find(n => n.filename === '00. Overview.md');
	assert.ok(overview, 'overview note must be named "00. Overview.md" for English files');
	// Book names follow the file language too: Luke, not Lukas.
	assert.ok(overview.content.includes('Luke 6:24-26'));

	const itemNote = result.notes.find(n => n.filename.startsWith('01.'));
	assert.equal(itemNote.content.split('\n')[0], '[[Saturday/00. Overview|↩ Back to Overview]]');
	assert.ok(itemNote.content.includes('**Day:** Saturday'));
	assert.ok(itemNote.content.includes('**Time:** 9:40'));
	assert.ok(itemNote.content.includes('**Scriptures:** ([Luke 6:24-26]'));
	assert.ok(itemNote.content.includes('**Speaker:**'));
	// "Song No. 89" keeps only the song designation as the link; the remark stays plain text.
	assert.ok(itemNote.content.includes(
		'**Next:** [Song No. 89](https://www.jw.org/finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102016889) and Announcements',
	));

	const review = result.notes.find(n => n.filename === 'Review.md');
	assert.ok(review, 'review note must be named "Review.md" for English files');
	assert.ok(review.content.startsWith('*Note: For the convention review'));
	assert.ok(review.content.includes('**Which thoughts drew you closer to Jehovah?**'));
});

test('an English circuit assembly links the printed questions note in its review hint', () => {
	const questions = coItem({ title: 'Find Answers to These Questions', scriptures: [] });
	const result = builder({ reviewNote: true }).buildNotes({
		type: 'CA-copgm', theme: 'Happy Is the One Trusting In Jehovah', year: 2027, lang: 'en',
		days: [enDay({ sessions: [{ name: 'Morning', items: [questions] }] })],
	});
	assert.equal(result.congressFolder, '2026-2027 Circuit Assembly – With Circuit Overseer – “Happy Is the One Trusting In Jehovah”');
	const review = result.notes.find(n => n.filename === 'Review.md');
	assert.ok(review.content.startsWith(
		'*Note: The meeting chairman will also consider the printed review questions: [[01. Find Answers to These Questions|Find Answers to These Questions]]*',
	));
});
