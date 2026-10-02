import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { L, displayName, interfaceLangFor } = await jiti.import('../src/i18n.ts');

const LANGS = ['de', 'en', 'fr', 'it', 'pt', 'ru', 'es', 'ko'];

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

test('each language exposes the six parser-side strings, not just interface text', () => {
	// The parser WRITES these into notes; it does not detect anything with
	// them (the anchors are regexes in JwpubParser — see the note on BASE).
	// A language added later still needs them, or its notes read English.
	for (const lang of LANGS) {
		for (const key of ['caFallbackDay', 'defaultSession', 'reviewQuestionsSession', 'questionsTitle', 'bibleDramaFallback']) {
			assert.equal(typeof L[lang][key], 'string', `${lang}.${key}`);
		}
		assert.equal(typeof L[lang].song, 'function', `${lang}.song`);
	}
});

// ── Korean: partly translated (issue #1) ────────────────────────────────────

test('Korean notes use the verified Korean wording', () => {
	// From the programme files and from a native speaker — see L.ko.
	assert.equal(L.ko.dayLabel, '날짜');
	assert.equal(L.ko.speakerLabel, '연사');
	assert.equal(L.ko.overviewBase, '00. 개요');
	assert.equal(L.ko.questionsTitle, '아래 질문에 대한 답을 찾아 보십시오');
	assert.equal(L.ko.song(89), '노래 89번');
});

test('Korean "Next" label carries no colon of its own', () => {
	// Supplied as "다음 프로:", but NoteBuilder writes `**${nextLabel}:**` — a
	// colon here would print as "다음 프로::".
	assert.equal(L.ko.nextLabel, '다음 프로');
	assert.doesNotMatch(L.ko.nextLabel, /:$/);
});

test('no Korean interface text was left in English', () => {
	// Every plain string, list and label map must contain Hangul. Catches a
	// key copied over from English and forgotten, which the compiler cannot.
	const hangul = /\p{Script=Hangul}/u;
	for (const [key, value] of Object.entries(L.ko)) {
		const texts = typeof value === 'string' ? [value]
			: Array.isArray(value) ? value
			: typeof value === 'object' ? Object.values(value)
			: [];
		for (const text of texts) assert.match(text, hangul, key);
	}
});

test('Korean notices and errors read Korean too', () => {
	const hangul = /\p{Script=Hangul}/u;
	assert.match(L.ko.noticeImportResult('폴더', 3, 1, 2), hangul);
	assert.match(L.ko.noticeUpdated('1.29.0'), hangul);
	for (const code of ['unknownFormat', 'noWebCrypto', 'rtfNoFiles', 'jwpubNoDatabase', 'fileTooLarge', 'mwbLanguageNotSupported']) {
		assert.match(L.ko.describeParseError(code, 'x'), hangul, code);
	}
});

test('Korean names every language the way jw.org does', () => {
	// From jw.org's own Korean language list.
	assert.equal(L.ko.langDisplay('ko'), '한국어');
	assert.equal(L.ko.langDisplay('de'), '독일어');
	assert.equal(L.ko.langDisplay('en'), '영어');
	assert.equal(displayName('ko', 'de'), 'Koreanisch');
});

test('a verse number reads in Korean word order', () => {
	// The unit follows the number in Korean; a translated prefix would not.
	assert.equal(L.ko.popupVerseLabel('12'), '12절');
	assert.equal(L.de.popupVerseLabel('12'), 'Vers 12');
});

test('a first start follows Obsidian’s language where the plugin has it', () => {
	assert.equal(interfaceLangFor('ko'), 'ko');
	assert.equal(interfaceLangFor('pt-BR'), 'pt');
	assert.equal(interfaceLangFor('en-GB'), 'en');
	assert.equal(interfaceLangFor('ja'), undefined);
	assert.equal(interfaceLangFor(undefined), undefined);
});

test('no Korean note string carries a zero-width space', () => {
	// The programme files put U+200B inside words; the values here were typed
	// without it on purpose, since several end up in file and folder names.
	const written = [
		'caFallbackDay', 'defaultSession', 'reviewQuestionsSession', 'questionsTitle',
		'bibleDramaFallback', 'overviewBase', 'dayLabel', 'timeLabel', 'scripturesLabel',
		'speakerLabel', 'nextLabel', 'coverImageBase', 'reviewNoteBase',
	].map(key => [key, L.ko[key]]);
	written.push(['song', L.ko.song(89)]);
	written.push(['folderCO', L.ko.folderCO(2026, '테마')]);
	written.push(['folderCAco', L.ko.folderCAco('2026-2027', '테마')]);
	written.push(['folderCAbr', L.ko.folderCAbr('2026-2027', '테마')]);
	for (const [key, text] of written) {
		assert.equal(typeof text, 'string', key);
		assert.ok(!text.includes('\u200b'), key);
	}
});

test('the workbook commands and settings are named in every interface language', () => {
	// Until 02.10.2026 only German and Korean had them, so the commands, the
	// ribbon icon and the settings section had no name anywhere else.
	const keys = ['headImportMwb', 'headImportMwbDesc', 'setImportMwbActionDesc', 'importMwbCommand', 'importMwbTitle',
		'importMwbFileDesc', 'updateMwbCommand', 'updateMwbTitle', 'updateMwbExplanation', 'setMwbTargetFolder',
		'setMwbTargetFolderDesc', 'importMwbTargetDesc', 'rowWeeks', 'headNoteFieldsMwb', 'setShowMwbDuration',
		'setShowMwbSourceCitation', 'setMwbFrontmatterDesc'];
	for (const lang of LANGS) {
		for (const key of keys) {
			assert.equal(typeof L[lang][key], 'string', `${lang}.${key}`);
			assert.ok(L[lang][key].length > 0, `${lang}.${key}`);
			if (lang !== 'de') assert.notEqual(L[lang][key], L.de[key], `${lang}.${key} is still German`);
		}
		assert.match(L[lang].noticeImportMwbResult('F', 2, 1, 0), /2/);
		assert.match(L[lang].noticeUpdateMwbResult(3, 0, 0, 1), /3/);
		assert.match(L[lang].noticeUpdateProgress(1, 4), /1\/4/);
		assert.notEqual(L[lang].noticeUpdateProgress(1, 4), L[lang].noticeImportProgress(1, 4), lang);
	}
});

test('a count of one reads in the singular, in every language that inflects for it', () => {
	// Until 02.10.2026 every notice was plural throughout: "1 notes would change".
	const singular = {
		de: '1 Notiz würde geändert, 1 bleibt unverändert, 1 benötigt einen vollständigen Reimport (älteres Format).',
		en: '1 note would change, 1 stays unchanged, 1 needs a full re-import (older format).',
		fr: '1 note serait modifiée, 1 reste inchangée, 1 nécessite une réimportation complète (ancien format).',
		it: '1 nota verrebbe modificata, 1 resta invariata, 1 richiede una reimportazione completa (formato più vecchio).',
		pt: '1 nota seria alterada, 1 permanece inalterada, 1 exige uma reimportação completa (formato mais antigo).',
		es: '1 nota cambiaría, 1 queda sin cambios, 1 requiere una reimportación completa (formato antiguo).',
	};
	const plural = {
		de: '2 Notizen würden geändert, 2 bleiben unverändert, 2 benötigen einen vollständigen Reimport (älteres Format).',
		en: '2 notes would change, 2 stay unchanged, 2 need a full re-import (older format).',
		fr: '2 notes seraient modifiées, 2 restent inchangées, 2 nécessitent une réimportation complète (ancien format).',
		it: '2 note verrebbero modificate, 2 restano invariate, 2 richiedono una reimportazione completa (formato più vecchio).',
		pt: '2 notas seriam alteradas, 2 permanecem inalteradas, 2 exigem uma reimportação completa (formato mais antigo).',
		es: '2 notas cambiarían, 2 quedan sin cambios, 2 requieren una reimportación completa (formato antiguo).',
	};
	for (const lang of Object.keys(singular)) {
		assert.equal(L[lang].previewSummary(1, 0, 1, 1), singular[lang], lang);
		assert.equal(L[lang].previewSummary(2, 0, 2, 2), plural[lang], lang);
	}
});

test('no count notice hedges with a bracketed plural any more', () => {
	// "Kongress(e)", "note(s)", "nota/e" — chosen once, from the count.
	const hedge = /\((?:e|s|en)\)|\/[ei](?![a-z])/;
	for (const lang of LANGS) {
		const t = L[lang];
		for (const n of [1, 2]) {
			for (const text of [t.noticeBulkUpdateResult(n, n, 0, 0, 0, []), t.noticeLegacyCorrectionsFound(n), t.noticeLegacyApplied(n, n)]) {
				assert.doesNotMatch(text, hedge, `${lang}: ${text}`);
			}
		}
	}
	assert.equal(L.de.noticeBulkUpdateResult(1, 1, 0, 0, 0, []), '1 Kongress aktualisiert: 1 Notiz aktualisiert.');
	assert.equal(L.en.noticeLegacyApplied(1, 0), '1 note updated.');
});

test('French takes the singular for zero as well', () => {
	assert.equal(L.fr.noticeImportResult('Dossier', 0, 0, 0), '« Dossier » : 0 nouvelle.');
	assert.equal(L.fr.noticeImportResult('Dossier', 2, 1, 0), '« Dossier » : 2 nouvelles, 1 mise à jour.');
	// The other languages only for exactly one.
	assert.equal(L.es.noticeImportResult('Carpeta', 0, 0, 0), '"Carpeta": 0 nuevas.');
});
