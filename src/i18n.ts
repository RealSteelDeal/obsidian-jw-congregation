import { CongressLang, SupportedLang } from './normalizer/bookNames';
import { CongressType } from './models/congress';

/**
 * Strings needed to generate notes from an imported programme file — driven by
 * Congress.lang (detected from the file's own `MepsLanguageIndex`, see
 * JwpubParser), independently of the plugin's UI language. Covers every
 * language the parser can detect (`CongressLang`), not just the two the UI
 * itself is translated into — see `NL` below.
 */
export interface NoteStrings {
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
}

/**
 * All user-visible strings that depend on a language — `NoteStrings` (see
 * above) plus everything driven by the plugin's own UI language
 * (settings.lang), which stays limited to German/English (popup labels,
 * settings tab, import dialog, notices) — translating the whole settings UI
 * into five more languages is a much larger undertaking than letting the
 * parser understand five more programme-file languages.
 */
export interface Strings extends NoteStrings {
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
	btnInsertAsQuote: string;
	noticeVerseInserted: string;
	noticeNoActiveNote: string;
	/** Suggestion label shown right after typing a scripture reference (e.g.
	 *  "Psalm 12:1") in any note — turns it into a jwlibrary:// link instead of
	 *  inserting the verse text (see `btnInsertAsQuote` for the other option). */
	scriptureSuggestLink: string;

	// ── Notices (settings.lang) ─────────────────────────────────────────────
	noticeUpdated: (version: string) => string;
	noticeBibleSaved: string;
	noticeBibleMissingOnDevice: string;
	noticeBibleLoadFailed: (err: string) => string;
	noticeBibleHint: string;
	noticeQuoteNeedsBibleFile: string;
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
	langDisplay: (lang: CongressLang) => string;
	typeLabels: Record<CongressType, string>;

	// ── Update-notes modal (settings.lang) ──────────────────────────────────
	updateCommand: string;
	updateTitle: string;
	updateExplanation: string;
	updateTargetFolder: string;
	updateTargetFolderDesc: string;
	updateNoFoldersFound: string;
	btnUpdate: string;
	noticeUpdateFolderNotFound: (path: string) => string;
	noticeUpdateResult: (merged: number, created: number, needsReimport: number, unchanged: number) => string;
}

/** Display name of every detectable programme-file language, in German and
 *  English (the only two the settings/import-modal UI itself is translated
 *  into) — used by `langDisplay` in both `L.de` and `L.en`. */
const LANG_DISPLAY_NAMES: Record<CongressLang, { de: string; en: string }> = {
	de: { de: 'Deutsch', en: 'German' },
	en: { de: 'Englisch', en: 'English' },
	fr: { de: 'Französisch', en: 'French' },
	it: { de: 'Italienisch', en: 'Italian' },
	pt: { de: 'Portugiesisch', en: 'Portuguese' },
	ru: { de: 'Russisch', en: 'Russian' },
	es: { de: 'Spanisch', en: 'Spanish' },
};

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
		btnInsertAsQuote: 'Als Zitat einfügen',
		noticeVerseInserted: 'Vers als Zitat eingefügt.',
		noticeNoActiveNote: 'Keine aktive Notiz zum Einfügen gefunden. Bitte zuerst eine Notiz öffnen.',
		scriptureSuggestLink: 'Verlinken',

		noticeUpdated: version => `JW Kongressprogramm wurde auf Version ${version} aktualisiert.\n\nVerbesserungen an den Notiz-Vorlagen erreichen bereits importierte Kongresse nicht automatisch: Dafür „Kongress-Notizen aktualisieren" (Befehlspalette) mit derselben Programmdatei ausführen – eigene Einträge (Redner, Notizen) bleiben dabei erhalten. Nur bei Notizen aus einer sehr alten Plugin-Version hilft das nicht; dort den Kongress-Ordner löschen und neu importieren.\n\n(Zum Schließen klicken)`,
		noticeBibleSaved: 'Bibel-Datei gespeichert.',
		noticeBibleMissingOnDevice: 'Die Bibel-Datei fehlt auf diesem Gerät (Einstellungen werden synchronisiert, die Datei selbst nicht). Bitte in den Plugin-Einstellungen unter „Bibel-Datei" neu auswählen.',
		noticeBibleLoadFailed: err => `Bibel-Datei konnte nicht geladen werden: ${err}`,
		noticeQuoteNeedsBibleFile: 'Keine Bibel-Datei geladen – die Bibelstelle wurde stattdessen verlinkt. Für den Direkt-Zitat-Modus in den Plugin-Einstellungen eine Bibel-Datei hinterlegen.',
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
		langDisplay: lang => LANG_DISPLAY_NAMES[lang].de,
		typeLabels: {
			'CO': 'Regionaler Kongress',
			'CA-copgm': 'Kreiskongress (Kreisaufseher)',
			'CA-brpgm': 'Kreiskongress (Zweigbüro)',
		},

		updateCommand: 'Kongress-Notizen aktualisieren',
		updateTitle: 'Kongress-Notizen aktualisieren',
		updateExplanation: 'Wählt dieselbe Programmdatei erneut aus und gleicht einen bereits importierten Kongress-Ordner damit ab – nützlich nach einem Plugin-Update, das einen Fehler in den Notizen behebt (z. B. bei Tag, Uhrzeit oder Bibelstellen). Bereits geschriebener Text (Rednername, eigene Notizen) bleibt dabei unangetastet; nur die automatisch erzeugten Felder werden aufgefrischt.',
		updateTargetFolder: 'Zu aktualisierender Kongress-Ordner',
		updateTargetFolderDesc: 'Der Ordner, der beim ursprünglichen Import angelegt wurde.',
		updateNoFoldersFound: 'Keine Ordner im Vault gefunden.',
		btnUpdate: 'Aktualisieren',
		noticeUpdateFolderNotFound: path => `Ordner „${path}" wurde nicht gefunden.`,
		noticeUpdateResult: (merged, created, needsReimport, unchanged) => {
			const parts = [`${merged} aktualisiert`];
			if (created > 0) parts.push(`${created} neu angelegt`);
			if (unchanged > 0) parts.push(`${unchanged} bereits aktuell`);
			if (needsReimport > 0) parts.push(`${needsReimport} benötigen einen vollständigen Reimport (älteres Format)`);
			return `Aktualisierung abgeschlossen: ${parts.join(', ')}.`;
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
		btnInsertAsQuote: 'Insert as quote',
		noticeVerseInserted: 'Verse inserted as a quote.',
		noticeNoActiveNote: 'No active note to insert into. Please open a note first.',
		scriptureSuggestLink: 'Link',

		noticeUpdated: version => `JW Convention Program was updated to version ${version}.\n\nNote-template improvements do not reach already imported conventions automatically: run "Update convention notes" (command palette) with the same program file to pick them up — anything you already typed (speaker, notes) is kept. Only notes from a very old plugin version can't be patched this way; delete the convention folder and re-import for those.\n\n(Click to dismiss)`,
		noticeBibleSaved: 'Bible file saved.',
		noticeBibleMissingOnDevice: 'The Bible file is missing on this device (settings sync between devices, the file itself does not). Please re-select it under "Bible file" in the plugin settings.',
		noticeBibleLoadFailed: err => `The Bible file could not be loaded: ${err}`,
		noticeQuoteNeedsBibleFile: 'No Bible file loaded – the scripture was linked instead. Add a Bible file in the plugin settings to insert quotes directly.',
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
		langDisplay: lang => LANG_DISPLAY_NAMES[lang].en,
		typeLabels: {
			'CO': 'Regional Convention',
			'CA-copgm': 'Circuit Assembly (Circuit Overseer)',
			'CA-brpgm': 'Circuit Assembly (Branch Representative)',
		},

		updateCommand: 'Update convention notes',
		updateTitle: 'Update convention notes',
		updateExplanation: 'Pick the same program file again and reconcile it against an already-imported convention folder — useful after a plugin update fixes a bug in the notes (e.g. day, time or scripture references). Anything you already typed (speaker name, personal notes) is left untouched; only the automatically generated fields are refreshed.',
		updateTargetFolder: 'Convention folder to update',
		updateTargetFolderDesc: 'The folder created by the original import.',
		updateNoFoldersFound: 'No folders found in the vault.',
		btnUpdate: 'Update',
		noticeUpdateFolderNotFound: path => `Folder "${path}" was not found.`,
		noticeUpdateResult: (merged, created, needsReimport, unchanged) => {
			const parts = [`${merged} updated`];
			if (created > 0) parts.push(`${created} newly created`);
			if (unchanged > 0) parts.push(`${unchanged} already up to date`);
			if (needsReimport > 0) parts.push(`${needsReimport} need a full re-import (older format)`);
			return `Update complete: ${parts.join(', ')}.`;
		},
	},
};

/**
 * Note-generation strings for every language the parser can detect
 * (`CongressLang`) — a superset of `L`, which only covers the two languages
 * the settings/popup UI itself is translated into. `de`/`en` are the same
 * `Strings` objects from `L` (a superset of `NoteStrings`); `fr`/`it`/`pt`/`ru`/
 * `es` are translated only as far as `NoteStrings` needs.
 *
 * Values not lifted verbatim from a real programme file (`questionsTitle`,
 * `bibleDramaFallback`, the type-marker vocabulary matched in JwpubParser) are
 * plain translations for plugin-generated text (folder names, field labels,
 * the standard review questions) that never appears in the source file itself.
 */
export const NL: Record<CongressLang, NoteStrings> = {
	de: L.de,
	en: L.en,
	fr: {
		caFallbackDay: 'Samedi',
		defaultSession: 'Matin',
		reviewQuestionsSession: 'Questions de révision',
		questionsTitle: 'Soyez attentifs aux réponses à ces questions',
		bibleDramaFallback: 'Film',
		song: n => `Cantique no ${n}`,

		overviewBase: '00. Aperçu',
		backToOverview: '↩ Retour à l’aperçu',
		dayLabel: 'Jour',
		timeLabel: 'Heure',
		scripturesLabel: 'Textes bibliques',
		speakerLabel: 'Orateur',
		nextLabel: 'Ensuite',
		coverImageBase: 'Image de couverture',
		reviewNoteBase: 'Révision',
		reviewQuestions: [
			'Quelles pensées vous ont rapproché de Jéhovah ?',
			'Quelles pensées pouvez-vous appliquer dans le ministère ?',
			'Quelles pensées pouvez-vous appliquer dans votre vie personnelle ?',
		],
		reviewHintCO: 'Remarque : Pour la partie « Points forts de l’assemblée », le frère passera la vidéo reprenant des extraits du programme de l’assemblée.',
		reviewHintCA: link => `Remarque : Le président de la réunion posera aussi les questions de révision imprimées : ${link}`,
		folderCO: (year, theme) => `Assemblée régionale ${year} – ${theme}`,
		folderCAco: (season, theme) => `Programme de l’assemblée de circonscription ${season} – avec le responsable de circonscription – « ${theme} »`,
		folderCAbr: (season, theme) => `Programme de l’assemblée de circonscription ${season} – avec un représentant de la filiale – « ${theme} »`,
	},
	it: {
		caFallbackDay: 'Sabato',
		defaultSession: 'Mattina',
		reviewQuestionsSession: 'Domande di ripasso',
		questionsTitle: 'Rispondete a queste domande',
		bibleDramaFallback: 'Videoracconto',
		song: n => `Cantico ${n}`,

		overviewBase: '00. Panoramica',
		backToOverview: '↩ Torna alla panoramica',
		dayLabel: 'Giorno',
		timeLabel: 'Ora',
		scripturesLabel: 'Testi biblici',
		speakerLabel: 'Oratore',
		nextLabel: 'A seguire',
		coverImageBase: 'Immagine di copertina',
		reviewNoteBase: 'Ripasso',
		reviewQuestions: [
			'Quali pensieri ti hanno avvicinato a Geova?',
			'Quali pensieri puoi applicare nel ministero?',
			'Quali pensieri puoi applicare nella tua vita personale?',
		],
		reviewHintCO: 'Nota: Per il ripasso del congresso, il fratello mostrerà il video con gli estratti del programma del congresso.',
		reviewHintCA: link => `Nota: Il presidente dell’adunanza tratterà anche le domande di ripasso stampate: ${link}`,
		folderCO: (year, theme) => `Congresso regionale ${year} – ${theme}`,
		folderCAco: (season, theme) => `Programma dell’assemblea di circoscrizione ${season} – con il sorvegliante di circoscrizione – "${theme}"`,
		folderCAbr: (season, theme) => `Programma dell’assemblea di circoscrizione ${season} – con il rappresentante della filiale – "${theme}"`,
	},
	pt: {
		caFallbackDay: 'Sábado',
		defaultSession: 'Manhã',
		reviewQuestionsSession: 'Perguntas de revisão',
		questionsTitle: 'Esteja atento às respostas para as seguintes perguntas',
		bibleDramaFallback: 'Vídeo',
		song: n => `Cântico ${n}`,

		overviewBase: '00. Visão geral',
		backToOverview: '↩ Voltar à visão geral',
		dayLabel: 'Dia',
		timeLabel: 'Hora',
		scripturesLabel: 'Textos bíblicos',
		speakerLabel: 'Orador',
		nextLabel: 'A seguir',
		coverImageBase: 'Imagem de capa',
		reviewNoteBase: 'Revisão',
		reviewQuestions: [
			'Que pensamentos o aproximaram de Jeová?',
			'Que pensamentos você pode aplicar no ministério?',
			'Que pensamentos você pode aplicar na sua vida pessoal?',
		],
		reviewHintCO: 'Nota: Na revisão do congresso, o irmão vai passar o vídeo com trechos do programa do congresso.',
		reviewHintCA: link => `Nota: O presidente da reunião também vai considerar as perguntas de revisão impressas: ${link}`,
		folderCO: (year, theme) => `Congresso regional ${year} – ${theme}`,
		folderCAco: (season, theme) => `Assembleia de Circuito ${season} – com o Superintendente de Circuito – "${theme}"`,
		folderCAbr: (season, theme) => `Assembleia de Circuito ${season} – com o Representante da Filial – "${theme}"`,
	},
	ru: {
		caFallbackDay: 'Суббота',
		defaultSession: 'Утро',
		reviewQuestionsSession: 'Вопросы для повторения',
		questionsTitle: 'Узнайте ответы на эти вопросы',
		bibleDramaFallback: 'Видеопостановка',
		song: n => `Песня № ${n}`,

		overviewBase: '00. Обзор',
		backToOverview: '↩ Назад к обзору',
		dayLabel: 'День',
		timeLabel: 'Время',
		scripturesLabel: 'Библейские тексты',
		speakerLabel: 'Докладчик',
		nextLabel: 'Далее',
		coverImageBase: 'Обложка',
		reviewNoteBase: 'Повторение',
		reviewQuestions: [
			'Какие мысли помогли вам сблизиться с Иеговой?',
			'Какие мысли вы можете применять в служении?',
			'Какие мысли вы можете применять в личной жизни?',
		],
		reviewHintCO: 'Примечание: На повторении конгресса брат покажет видео с отрывками из программы конгресса.',
		reviewHintCA: link => `Примечание: Председательствующий также рассмотрит напечатанные вопросы для повторения: ${link}`,
		folderCO: (year, theme) => `Конгресс ${year} года – ${theme}`,
		folderCAco: (season, theme) => `Программа районного конгресса ${season} – с районным старейшиной – «${theme}»`,
		folderCAbr: (season, theme) => `Программа районного конгресса ${season} – с представителем филиала – «${theme}»`,
	},
	es: {
		caFallbackDay: 'Sábado',
		defaultSession: 'Mañana',
		reviewQuestionsSession: 'Preguntas de repaso',
		questionsTitle: 'Anota las respuestas a las siguientes preguntas',
		bibleDramaFallback: 'Producción audiovisual',
		song: n => `Canción ${n}`,

		overviewBase: '00. Resumen',
		backToOverview: '↩ Volver al resumen',
		dayLabel: 'Día',
		timeLabel: 'Hora',
		scripturesLabel: 'Textos bíblicos',
		speakerLabel: 'Orador',
		nextLabel: 'A continuación',
		coverImageBase: 'Imagen de portada',
		reviewNoteBase: 'Repaso',
		reviewQuestions: [
			'¿Qué pensamientos lo acercaron más a Jehová?',
			'¿Qué pensamientos puede aplicar en el ministerio?',
			'¿Qué pensamientos puede aplicar en su vida personal?',
		],
		reviewHintCO: 'Nota: En el repaso del congreso, el hermano pondrá el video con extractos del programa del congreso.',
		reviewHintCA: link => `Nota: El presidente de la reunión también considerará las preguntas de repaso impresas: ${link}`,
		folderCO: (year, theme) => `Asamblea regional ${year} – ${theme}`,
		folderCAco: (season, theme) => `Programa de la asamblea de circuito ${season} – con el superintendente de circuito – "${theme}"`,
		folderCAbr: (season, theme) => `Programa de la asamblea de circuito ${season} – con representante de la sucursal – "${theme}"`,
	},
};
