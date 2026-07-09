import { SupportedLang } from './normalizer/bookNames';

/**
 * All user-visible strings that depend on a language.
 *
 * Two different "languages" flow through the plugin — don't mix them up:
 *
 * - **Congress.lang** (detected from the imported file's `MepsLanguageIndex`,
 *   see JwpubParser): drives everything written INTO generated notes — labels,
 *   file/folder names, the review note. An English programme file produces
 *   English notes regardless of the plugin's UI language, since mixing
 *   languages inside one note would help nobody.
 * - **settings.lang** (user setting): drives the Bible-verse popup labels and
 *   scripture book names there.
 */
export interface Strings {
	// ── Parser (Congress.lang) ──────────────────────────────────────────────
	/** One-day circuit assemblies have no weekday in their h1 (it holds the theme). */
	caFallbackDay: string;
	/** Only used if a day document unexpectedly has items before its first <h2>. */
	defaultSession: string;
	/** Session name for the standalone printed review-questions document. */
	reviewQuestionsSession: string;
	/** Canonical title for the printed review-questions note (also the h1 match). */
	questionsTitle: string;
	bibleDramaFallback: string;
	song: (n: number) => string;

	// ── Note generation (Congress.lang) ─────────────────────────────────────
	overviewBase: string;
	backToOverview: string;
	dayLabel: string;
	timeLabel: string;
	scripturesLabel: string;
	speakerLabel: string;
	nextLabel: string;
	coverImageBase: string;
	reviewNoteBase: string;
	reviewQuestions: [string, string, string];
	reviewHintCO: string;
	reviewHintCA: (questionsLink: string) => string;
	folderCO: (year: number, theme: string) => string;
	folderCAco: (season: string, theme: string) => string;
	folderCAbr: (season: string, theme: string) => string;

	// ── Bible-verse popup (settings.lang) ───────────────────────────────────
	popupLoading: string;
	popupMissing: string;
	popupOpenJwLibrary: string;
	popupFootnotes: string;
	popupCrossRefs: string;
	popupStudyNotes: string;
	popupVersePrefix: string;
	popupNoText: string;
}

export const L: Record<SupportedLang, Strings> = {
	de: {
		caFallbackDay: 'Samstag',
		defaultSession: 'Vormittag',
		reviewQuestionsSession: 'Wiederholungsfragen',
		questionsTitle: 'Beantworte die folgenden Fragen',
		bibleDramaFallback: 'Bibeldrama',
		song: n => `Lied ${n}`,

		overviewBase: '00. Übersicht',
		backToOverview: '↩ Zur Übersicht',
		dayLabel: 'Tag',
		timeLabel: 'Uhrzeit',
		scripturesLabel: 'Bibeltexte',
		speakerLabel: 'Redner',
		nextLabel: 'Anschließend',
		coverImageBase: 'Titelbild',
		reviewNoteBase: 'Wiederholung',
		reviewQuestions: [
			'Welche Gedanken haben dich Jehova nähergebracht?',
			'Welche Gedanken kannst du im Predigtdienst anwenden?',
			'Welche Gedanken kannst du in deinem persönlichen Leben anwenden?',
		],
		reviewHintCO: 'Hinweis: Bei der Kongress-Wiederholung für den regionalen Kongress wird der Bruder beim Programmpunkt das Video mit Auszügen aus dem Kongressprogramm abspielen.',
		reviewHintCA: link => `Hinweis: Der Versammlungsleiter stellt außerdem die gedruckten Wiederholungsfragen: ${link}`,
		folderCO: (year, theme) => `Regionaler Kongress ${year} – ${theme}`,
		folderCAco: (season, theme) => `Kreiskongressprogramm ${season} – mit dem Kreisaufseher – „${theme}“`,
		folderCAbr: (season, theme) => `Kreiskongressprogramm ${season} – mit dem Vertreter des Zweigbüros – „${theme}“`,

		popupLoading: 'Lade Bibeltext …',
		popupMissing: 'Kein Vers-Text verfügbar (diese Stelle ist in der geladenen Bibel-Datei nicht indiziert).',
		popupOpenJwLibrary: 'In JW Library öffnen',
		popupFootnotes: 'Fußnoten',
		popupCrossRefs: 'Querverweise',
		popupStudyNotes: 'Studienanmerkungen',
		popupVersePrefix: 'Vers',
		popupNoText: '(kein Text verfügbar)',
	},
	en: {
		caFallbackDay: 'Saturday',
		defaultSession: 'Morning',
		reviewQuestionsSession: 'Review Questions',
		// Matches the real h1 of the standalone questions document in English
		// circuit-assembly files ("Find Answers to These Questions:").
		questionsTitle: 'Find Answers to These Questions',
		bibleDramaFallback: 'Bible Drama',
		song: n => `Song ${n}`,

		overviewBase: '00. Overview',
		backToOverview: '↩ Back to Overview',
		dayLabel: 'Day',
		timeLabel: 'Time',
		scripturesLabel: 'Scriptures',
		speakerLabel: 'Speaker',
		nextLabel: 'Next',
		coverImageBase: 'Cover',
		reviewNoteBase: 'Review',
		reviewQuestions: [
			'Which thoughts drew you closer to Jehovah?',
			'Which thoughts can you apply in the ministry?',
			'Which thoughts can you apply in your personal life?',
		],
		reviewHintCO: 'Note: For the convention review, the brother will play the video with excerpts from the convention program.',
		reviewHintCA: link => `Note: The meeting chairman will also consider the printed review questions: ${link}`,
		folderCO: (year, theme) => `${year} Regional Convention – ${theme}`,
		folderCAco: (season, theme) => `${season} Circuit Assembly – With Circuit Overseer – “${theme}”`,
		folderCAbr: (season, theme) => `${season} Circuit Assembly – With Branch Representative – “${theme}”`,

		popupLoading: 'Loading Bible text …',
		popupMissing: 'No verse text available (this passage is not indexed in the loaded Bible file).',
		popupOpenJwLibrary: 'Open in JW Library',
		popupFootnotes: 'Footnotes',
		popupCrossRefs: 'Cross-references',
		popupStudyNotes: 'Study notes',
		popupVersePrefix: 'Verse',
		popupNoText: '(no text available)',
	},
};
