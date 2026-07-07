import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { NoteBuilder } = await jiti.import('../src/builder/NoteBuilder.ts');

function builder(opts = {}) {
	return new NoteBuilder({ lang: 'de', scriptureLinks: true, ...opts });
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
	return { type: 'CO', theme: 'Ewiges Glück', year: 2026, days };
}

test('congressFolderName formats each congress type', () => {
	const b = builder();
	assert.equal(
		b.congressFolderName({ type: 'CO', theme: 'Ewiges Glück', year: 2026, days: [] }),
		'Regionaler Kongress 2026 – Ewiges Glück',
	);
	assert.equal(
		b.congressFolderName({ type: 'CA-copgm', theme: 'Titel', year: 2027, days: [] }),
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
			'„Geben macht glücklicher als Empfangen“ ([Apostelgeschichte 20:35](jwlibrary:///finder?bible=44020035&pub=nwtsty))',
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
		'(<a href="jwlibrary:///finder?bible=40005001-40005002&pub=nwtsty">Matthäus 5:1-2</a>; ' +
		'<a href="jwlibrary:///finder?bible=19100002&pub=nwtsty">Psalmen 100:2</a>)',
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
		'**Bibeltexte:** ([Psalmen 16:11](jwlibrary:///finder?bible=19016011&pub=nwtsty); ' +
		'[Psalmen 100:2](jwlibrary:///finder?bible=19100002&pub=nwtsty))',
	));
});

test('scriptureLinks: false renders plain text instead of markdown links', () => {
	const item = coItem({ scriptures: [{ book: 19, chapter: 16, verseStart: 11 }] });
	const result = builder({ scriptureLinks: false }).buildNotes(
		coCongress([coDay({ sessions: [{ name: 'Vormittag', items: [item] }] })]),
	);
	const itemNote = result.notes.find(n => n.filename !== '00. Übersicht.md');
	assert.ok(itemNote.content.includes('**Bibeltexte:** (Psalmen 16:11)'));
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
