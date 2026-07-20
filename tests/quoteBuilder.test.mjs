import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { buildScriptureQuoteBlock, stripHtml } = await jiti.import('../src/util/quoteBuilder.ts');

function verse(number, text) {
	return { number, isChapterStart: false, segments: [{ kind: 'text', text }], footnotes: [], crossReferences: [], studyNotes: [] };
}

const HREF = 'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19001001&pub=nwtsty';

test('buildScriptureQuoteBlock renders both the title and the verse text as jwlibrary links to the same href', () => {
	const block = buildScriptureQuoteBlock('Psalm 1:1', HREF, [verse('1', 'Glücklich ist der Mensch …')]);
	assert.equal(block, `> [!quote] [Psalm 1:1](${HREF})\n> [1 Glücklich ist der Mensch …](${HREF})\n`);
});

test('buildScriptureQuoteBlock joins multiple verses into one linked blockquote line, separated by their number', () => {
	const block = buildScriptureQuoteBlock('Psalm 1:1, 2', HREF, [
		verse('1', 'Erster Vers.'),
		verse('2', 'Zweiter Vers.'),
	]);
	assert.equal(block, `> [!quote] [Psalm 1:1, 2](${HREF})\n> [1 Erster Vers. 2 Zweiter Vers.](${HREF})\n`);
});

test('buildScriptureQuoteBlock leaves out footnote/cross-reference marker segments', () => {
	const withMarker = {
		number: '1', isChapterStart: false,
		segments: [{ kind: 'text', text: 'Text mit Marker' }, { kind: 'footnote', symbol: 'a' }],
		footnotes: [], crossReferences: [], studyNotes: [],
	};
	const block = buildScriptureQuoteBlock('Beispiel 1:1', HREF, [withMarker]);
	assert.equal(block, `> [!quote] [Beispiel 1:1](${HREF})\n> [1 Text mit Marker](${HREF})\n`);
});

test('stripHtml reduces HTML markup to plain text', () => {
	assert.equal(stripHtml('<strong>5</strong>'), '5');
	assert.equal(stripHtml(''), '');
});
