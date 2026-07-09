import { SupportedLang } from './normalizer/bookNames';
import { CongressType } from './models/congress';

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
	popupLoadFailed: string;
	popupOpenJwLibrary: string;
	popupFootnotes: string;
	popupCrossRefs: string;
	popupStudyNotes: string;
	popupVersePrefix: string;
	popupNoText: string;
	popupBack: string;
	popupVerseBefore: string;
	popupVerseAfter: string;
	popupWholeChapter: string;

	// ── Notices (settings.lang) ─────────────────────────────────────────────
	noticeUpdated: (version: string) => string;
	noticeBibleSaved: string;
	noticeBibleMissingOnDevice: string;
	noticeBibleLoadFailed: (err: string) => string;
	noticeBibleHint: string;
	noticeImportFailed: (err: string) => string;
	noticeRtfFallback: string;
	noticeImportProgress: (done: number, total: number) => string;
	noticeImportResult: (folder: string, created: number, updated: number, skipped: number) => string;
	noticeImportRolledBack: (err: string) => string;
	noticePickFileFirst: string;
	noticeOpenOverviewHint: string;
	noticeNotAFolder: (path: string) => string;

	// ── Settings tab (settings.lang) ────────────────────────────────────────
	setTargetFolder: string;
	setTargetFolderDesc: string;
	setTargetFolderPlaceholder: string;
	setLang: string;
	setLangDesc: string;
	setScriptureLinks: string;
	setScriptureLinksDesc: string;
	setReviewNote: string;
	setReviewNoteDesc: string;
	headNoteFields: string;
	setShowDay: string;
	setShowDayDesc: string;
	setShowTime: string;
	setShowScriptures: string;
	setShowSpeaker: string;
	setExtraFields: string;
	setExtraFieldsDesc: string;
	setFrontmatter: string;
	setFrontmatterDesc: string;
	headPopup: string;
	setBibleFile: string;
	bibleDescLoaded: string;
	bibleDescMissing: string;
	btnChooseFile: string;
	btnReplaceFile: string;
	btnRemoveBible: string;

	// ── Import modal (settings.lang) ────────────────────────────────────────
	importTitle: string;
	importCommand: string;
	importFileName: string;
	importFileDesc: string;
	btnPickFile: string;
	importTarget: string;
	importTargetDesc: string;
	optVaultRoot: string;
	optNewFolder: string;
	importNewFolder: string;
	importNewFolderPlaceholder: string;
	btnImport: string;
	btnCancel: string;
	previewHeading: string;
	previewFailed: (err: string) => string;
	rowType: string;
	rowTheme: string;
	rowYear: string;
	rowDays: string;
	rowSource: string;
	rowSourceRtf: string;
	rowItems: string;
	rowLanguage: string;
	langDisplay: (lang: SupportedLang) => string;
	typeLabels: Record<CongressType, string>;
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
		popupLoadFailed: 'Die Bibel-Datei konnte nicht geladen werden. Der Button unten öffnet die Stelle stattdessen in JW Library.',
		popupOpenJwLibrary: 'In JW Library öffnen',
		popupFootnotes: 'Fußnoten',
		popupCrossRefs: 'Querverweise',
		popupStudyNotes: 'Studienanmerkungen',
		popupVersePrefix: 'Vers',
		popupNoText: '(kein Text verfügbar)',
		popupBack: 'Zurück zur vorherigen Stelle',
		popupVerseBefore: '◀ Vers davor',
		popupVerseAfter: 'Vers danach ▶',
		popupWholeChapter: 'Ganzes Kapitel',

		noticeUpdated: version => `JW Kongressprogramm wurde auf Version ${version} aktualisiert.\n\nVerbesserungen an den Notiz-Vorlagen erreichen bereits importierte Kongresse nicht automatisch: Um sie zu übernehmen, den Kongress-Ordner löschen und die Programmdatei neu importieren.\n\n(Zum Schließen klicken)`,
		noticeBibleSaved: 'Bibel-Datei gespeichert.',
		noticeBibleMissingOnDevice: 'Die Bibel-Datei fehlt auf diesem Gerät (Einstellungen werden synchronisiert, die Datei selbst nicht). Bitte in den Plugin-Einstellungen unter „Bibel-Datei" neu auswählen.',
		noticeBibleLoadFailed: err => `Bibel-Datei konnte nicht geladen werden: ${err}`,
		noticeBibleHint: 'Tipp: Hinterlege in den Plugin-Einstellungen eine Bibel-jwpub-Datei (z. B. die Studienbibel von jw.org), dann öffnet ein Klick auf eine Bibelstelle den Vers-Text samt Querverweisen und Studienanmerkungen direkt als Popup in Obsidian. (Klicken öffnet die Einstellungen)',
		noticeImportFailed: err => `Import fehlgeschlagen: ${err}`,
		noticeRtfFallback: 'Jwpub-Parsing fehlgeschlagen – RTF-Fallback verwendet.',
		noticeImportProgress: (done, total) => `Import läuft … ${done}/${total}`,
		noticeImportResult: (folder, created, updated, skipped) => {
			const parts = [`${created} neu`];
			if (updated > 0) parts.push(`${updated} aktualisiert`);
			if (skipped > 0) parts.push(`${skipped} übersprungen (bereits vorhanden)`);
			return `„${folder}": ${parts.join(', ')}.`;
		},
		noticeImportRolledBack: err => `Import fehlgeschlagen, bereits erstellte Dateien wurden zurückgerollt: ${err}`,
		noticePickFileFirst: 'Bitte zuerst eine Datei wählen.',
		noticeOpenOverviewHint: '(Klicken, um die Übersicht zu öffnen)',
		noticeNotAFolder: path => `„${path}" ist keine Ordner-Datei.`,

		setTargetFolder: 'Zielordner',
		setTargetFolderDesc: 'Übergeordneter Ordner, in dem der Kongressordner angelegt wird. Leer lassen, damit jeder Kongress direkt als eigener Ordner in der Vault-Wurzel entsteht (kein zusätzlicher Wrapper-Ordner).',
		setTargetFolderPlaceholder: '(Vault-Wurzel)',
		setLang: 'Sprache der Oberfläche und des Bibeltext-Popups',
		setLangDesc: 'Beschriftungen des Plugins und Bibelbuch-Namen im Popup. Notizen folgen automatisch der Sprache der importierten Programmdatei.',
		setScriptureLinks: 'Bibelstellen verlinken',
		setScriptureLinksDesc: 'Erzeugt klickbare JW-Library-Links auf jede Bibelstelle.',
		setReviewNote: 'Wiederholungs-Notiz erstellen',
		setReviewNoteDesc: 'Legt zusätzlich eine "Wiederholung"-Notiz mit den drei Standard-Reflexionsfragen an (bei Kreiskongressen mit Link zu den gedruckten Wiederholungsfragen, bei Regionalen Kongressen mit Hinweis auf das Video).',
		headNoteFields: 'Notiz-Felder',
		setShowDay: 'Feld "Tag" anzeigen',
		setShowDayDesc: 'Nur bei Regionalen Kongressen relevant (Kreiskongresse sind eintägig).',
		setShowTime: 'Feld "Uhrzeit" anzeigen',
		setShowScriptures: 'Feld "Bibeltexte" anzeigen',
		setShowSpeaker: 'Feld "Redner" anzeigen',
		setExtraFields: 'Zusätzliche Felder',
		setExtraFieldsDesc: 'Jede Zeile wird als eigenes Feld mit eigenem Schreibplatz an jede Programmpunkt-Notiz angehängt (z. B. "**Notizen:**").',
		setFrontmatter: 'Frontmatter (Eigenschaften) hinzufügen',
		setFrontmatterDesc: 'Fügt jeder erzeugten Notiz YAML-Frontmatter mit stabilen englischen Schlüsseln hinzu (convention, type, day, time) – z. B. für Dataview-Abfragen. Die Schlüssel sind bewusst sprachunabhängig.',
		headPopup: 'Bibeltext-Popup',
		setBibleFile: 'Bibel-Datei',
		bibleDescLoaded: 'Bibel-Datei ist geladen. Ein Klick auf eine Bibelstelle zeigt den Vers-Text direkt in Obsidian an (mit einem Button zum Öffnen in JW Library).',
		bibleDescMissing: 'Optional: eine Bibel-jwpub-Datei auswählen (z. B. von jw.org heruntergeladen), damit ein Klick auf eine Bibelstelle den Vers-Text direkt in Obsidian anzeigt, statt nur JW Library zu öffnen. Die Studienbibel (nwtsty) bietet Studienanmerkungen und mehr Fußnoten; auf Mobilgeräten mit wenig Arbeitsspeicher ist die deutlich kleinere einfache Ausgabe (nwt) die speicherschonendere Wahl. Die Datei wird lokal im Plugin-Ordner gespeichert, nicht ins Vault kopiert.',
		btnChooseFile: 'Datei wählen …',
		btnReplaceFile: 'Datei ersetzen …',
		btnRemoveBible: 'Bibel-Datei entfernen',

		importTitle: 'Kongressprogramm importieren',
		importCommand: 'Kongressprogramm importieren',
		importFileName: 'Programmdatei',
		importFileDesc: 'Wähle eine .jwpub-Datei oder ein RTF-ZIP.',
		btnPickFile: 'Datei wählen …',
		importTarget: 'Zielordner',
		importTargetDesc: 'Standard: Vault-Wurzel – der Kongress wird direkt als eigener Ordner angelegt, ohne Wrapper-Ordner. Alternativ einen bestehenden Ordner wählen oder einen neuen anlegen.',
		optVaultRoot: 'Vault-Wurzel (kein Unterordner)',
		optNewFolder: '➕ Neuer Ordner …',
		importNewFolder: 'Name des neuen Ordners',
		importNewFolderPlaceholder: 'z. B. Kongress',
		btnImport: 'Importieren',
		btnCancel: 'Abbrechen',
		previewHeading: 'Vorschau',
		previewFailed: err => `Vorschau nicht möglich: ${err}`,
		rowType: 'Typ',
		rowTheme: 'Motto',
		rowYear: 'Jahr',
		rowDays: 'Tage',
		rowSource: 'Quelle',
		rowSourceRtf: 'RTF (Fallback)',
		rowItems: 'Programmpunkte',
		rowLanguage: 'Sprache',
		langDisplay: lang => (lang === 'de' ? 'Deutsch' : 'Englisch'),
		typeLabels: {
			'CO': 'Regionaler Kongress',
			'CA-copgm': 'Kreiskongress (Kreisaufseher)',
			'CA-brpgm': 'Kreiskongress (Zweigbüro)',
		},
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
		popupLoadFailed: 'The Bible file could not be loaded. The button below opens the passage in JW Library instead.',
		popupOpenJwLibrary: 'Open in JW Library',
		popupFootnotes: 'Footnotes',
		popupCrossRefs: 'Cross-references',
		popupStudyNotes: 'Study notes',
		popupVersePrefix: 'Verse',
		popupNoText: '(no text available)',
		popupBack: 'Back to the previous passage',
		popupVerseBefore: '◀ Verse before',
		popupVerseAfter: 'Verse after ▶',
		popupWholeChapter: 'Whole chapter',

		noticeUpdated: version => `JW Convention Program was updated to version ${version}.\n\nNote-template improvements do not reach already imported conventions automatically: to pick them up, delete the convention folder and re-import the program file.\n\n(Click to dismiss)`,
		noticeBibleSaved: 'Bible file saved.',
		noticeBibleMissingOnDevice: 'The Bible file is missing on this device (settings sync between devices, the file itself does not). Please re-select it under "Bible file" in the plugin settings.',
		noticeBibleLoadFailed: err => `The Bible file could not be loaded: ${err}`,
		noticeBibleHint: 'Tip: Add a Bible jwpub file (e.g. the study edition from jw.org) in the plugin settings — clicking a scripture will then open the verse text with cross-references and study notes directly as a popup in Obsidian. (Click to open the settings)',
		noticeImportFailed: err => `Import failed: ${err}`,
		noticeRtfFallback: 'jwpub parsing failed – RTF fallback used.',
		noticeImportProgress: (done, total) => `Importing … ${done}/${total}`,
		noticeImportResult: (folder, created, updated, skipped) => {
			const parts = [`${created} new`];
			if (updated > 0) parts.push(`${updated} updated`);
			if (skipped > 0) parts.push(`${skipped} skipped (already present)`);
			return `“${folder}”: ${parts.join(', ')}.`;
		},
		noticeImportRolledBack: err => `Import failed; files created so far were rolled back: ${err}`,
		noticePickFileFirst: 'Please pick a file first.',
		noticeOpenOverviewHint: '(Click to open the overview)',
		noticeNotAFolder: path => `“${path}” is not a folder.`,

		setTargetFolder: 'Target folder',
		setTargetFolderDesc: 'Parent folder in which convention folders are created. Leave empty so each convention becomes its own top-level folder in the vault root (no extra wrapper folder).',
		setTargetFolderPlaceholder: '(vault root)',
		setLang: 'Language of the interface and Bible-verse popup',
		setLangDesc: 'Plugin labels and Bible book names in the popup. Notes automatically follow the language of the imported program file.',
		setScriptureLinks: 'Link scriptures',
		setScriptureLinksDesc: 'Generates clickable JW Library links for every scripture.',
		setReviewNote: 'Create review note',
		setReviewNoteDesc: 'Additionally creates a "Review" note with the three standard reflection questions (circuit assemblies link to the printed review questions, regional conventions mention the highlights video).',
		headNoteFields: 'Note fields',
		setShowDay: 'Show "Day" field',
		setShowDayDesc: 'Only relevant for regional conventions (circuit assemblies are one day).',
		setShowTime: 'Show "Time" field',
		setShowScriptures: 'Show "Scriptures" field',
		setShowSpeaker: 'Show "Speaker" field',
		setExtraFields: 'Extra fields',
		setExtraFieldsDesc: 'Each line is appended to every program-item note as its own field with its own writing space (e.g. "**Notes:**").',
		setFrontmatter: 'Add frontmatter (properties)',
		setFrontmatterDesc: 'Adds YAML frontmatter with stable English keys (convention, type, day, time) to every generated note – e.g. for Dataview queries. Keys are deliberately language-independent.',
		headPopup: 'Bible-verse popup',
		setBibleFile: 'Bible file',
		bibleDescLoaded: 'Bible file is loaded. Clicking a scripture shows the verse text directly in Obsidian (with a button to open it in JW Library).',
		bibleDescMissing: 'Optional: pick a Bible jwpub file (e.g. downloaded from jw.org) so that clicking a scripture shows the verse text directly in Obsidian instead of only opening JW Library. The study edition (nwtsty) offers study notes and more footnotes; on mobile devices with limited memory the much smaller regular edition (nwt) is the memory-friendly choice. The file is stored locally in the plugin folder, not copied into the vault.',
		btnChooseFile: 'Choose file …',
		btnReplaceFile: 'Replace file …',
		btnRemoveBible: 'Remove Bible file',

		importTitle: 'Import convention program',
		importCommand: 'Import convention program',
		importFileName: 'Program file',
		importFileDesc: 'Pick a .jwpub file or an RTF ZIP.',
		btnPickFile: 'Choose file …',
		importTarget: 'Target folder',
		importTargetDesc: 'Default: vault root – the convention is created directly as its own folder, without a wrapper folder. Alternatively pick an existing folder or create a new one.',
		optVaultRoot: 'Vault root (no subfolder)',
		optNewFolder: '➕ New folder …',
		importNewFolder: 'Name of the new folder',
		importNewFolderPlaceholder: 'e.g. Conventions',
		btnImport: 'Import',
		btnCancel: 'Cancel',
		previewHeading: 'Preview',
		previewFailed: err => `Preview not possible: ${err}`,
		rowType: 'Type',
		rowTheme: 'Theme',
		rowYear: 'Year',
		rowDays: 'Days',
		rowSource: 'Source',
		rowSourceRtf: 'RTF (fallback)',
		rowItems: 'Program items',
		rowLanguage: 'Language',
		langDisplay: lang => (lang === 'de' ? 'German' : 'English'),
		typeLabels: {
			'CO': 'Regional Convention',
			'CA-copgm': 'Circuit Assembly (Circuit Overseer)',
			'CA-brpgm': 'Circuit Assembly (Branch Representative)',
		},
	},
};
