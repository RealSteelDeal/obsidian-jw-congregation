import { CongressLang, SupportedLang } from './normalizer/bookNames';
import { CongressType } from './models/congress';

/**
 * Strings needed to generate notes from an imported programme file — driven by
 * Congress.lang (detected from the file's own `MepsLanguageIndex`, see
 * JwpubParser), independently of the plugin's UI language. A subset of
 * `Strings` (see below) — kept as its own interface so code that only builds
 * notes (NoteBuilder, JwpubParser) doesn't need to know about popup/settings
 * strings it never uses. See `NL` below for how it's derived from `L`.
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
 * (settings.lang): popup labels, settings tab, import/update dialogs,
 * notices. Translated into every language `SupportedLang` covers, same as
 * `NoteStrings`.
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
	/** Same as `scriptureSuggestLink`, but also immediately opens the link in JW Library. */
	scriptureSuggestLinkAndOpen: string;
	/** Same as `btnInsertAsQuote` in the suggester, but the typed reference becomes
	 *  a link instead of being replaced by the quote. */
	scriptureSuggestQuoteKeepLink: string;

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
	headImport: string;
	headImportDesc: string;
	setImportActionDesc: string;
	btnOpen: string;
	headGeneral: string;
	setTargetFolder: string;
	setTargetFolderDesc: string;
	setTargetFolderPlaceholder: string;
	setLang: string;
	setLangDesc: string;
	headScripture: string;
	setScriptureLinks: string;
	setScriptureLinksDesc: string;
	setBiblePopupEnabled: string;
	setBiblePopupEnabledDesc: string;
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
	setBibleFile: string;
	bibleDescLoaded: string;
	bibleDescMissing: string;
	btnChooseFile: string;
	btnReplaceFile: string;
	btnRemoveBible: string;
	headScriptureSuggest: string;
	headScriptureSuggestDesc: string;
	btnMoveUp: string;
	btnMoveDown: string;

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

	// ── Legacy note migration modal (settings.lang) ─────────────────────────
	legacyModalTitle: string;
	legacyModalDesc: string;
	noticeLegacyCorrectionsFound: (count: number) => string;
	noticeLegacyApplied: (count: number) => string;
	btnApply: string;
}

/** Display name of every detectable programme-file language, in every UI
 *  language the settings/import-modal itself is translated into — used by
 *  `langDisplay` in each `L.<lang>`. Indexed [program-file language][UI
 *  language]; e.g. LANG_DISPLAY_NAMES.fr.es is Spanish for "French". */
const LANG_DISPLAY_NAMES: Record<CongressLang, Record<SupportedLang, string>> = {
	de: { de: 'Deutsch', en: 'German', fr: 'Allemand', it: 'Tedesco', pt: 'Alemão', ru: 'Немецкий', es: 'Alemán' },
	en: { de: 'Englisch', en: 'English', fr: 'Anglais', it: 'Inglese', pt: 'Inglês', ru: 'Английский', es: 'Inglés' },
	fr: { de: 'Französisch', en: 'French', fr: 'Français', it: 'Francese', pt: 'Francês', ru: 'Французский', es: 'Francés' },
	it: { de: 'Italienisch', en: 'Italian', fr: 'Italien', it: 'Italiano', pt: 'Italiano', ru: 'Итальянский', es: 'Italiano' },
	pt: { de: 'Portugiesisch', en: 'Portuguese', fr: 'Portugais', it: 'Portoghese', pt: 'Português', ru: 'Португальский', es: 'Portugués' },
	ru: { de: 'Russisch', en: 'Russian', fr: 'Russe', it: 'Russo', pt: 'Russo', ru: 'Русский', es: 'Ruso' },
	es: { de: 'Spanisch', en: 'Spanish', fr: 'Espagnol', it: 'Spagnolo', pt: 'Espanhol', ru: 'Испанский', es: 'Español' },
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
		scriptureSuggestLinkAndOpen: 'Verlinken & JW Library öffnen',
		scriptureSuggestQuoteKeepLink: 'Zitat einfügen & Verlinkung behalten',

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

		headImport: 'Kongressprogramm importieren & aktualisieren',
		headImportDesc: 'Zwei Wege, ein Kongressprogramm einzuspielen: „Kongressprogramm importieren" legt einen neuen Kongress-Ordner an – bei erneutem Import in denselben Ordner werden nur rein automatisch erzeugte Dateien aufgefrischt (Übersicht, Titelbild), Notizen mit eigenen Einträgen bleiben unangetastet. „Kongress-Notizen aktualisieren" gleicht stattdessen einen bereits importierten Ordner Feld für Feld ab (Tag, Uhrzeit, Bibelstellen, Überschriften) – auch innerhalb bereits bearbeiteter Notizen, ohne eigene Einträge zu verlieren. Praktisch z. B. nach einem Plugin-Update, das einen Fehler in den Notizen behebt. Für Notizen aus einer sehr alten Plugin-Version (ohne unsichtbare Marker) bietet „Kongress-Notizen aktualisieren" stattdessen ein Prüffenster mit vorgeschlagenen Korrekturen an, die einzeln bestätigt werden können.',
		setImportActionDesc: 'Wählt eine Programmdatei und legt daraus Notizen an (siehe Erklärung oben).',
		btnOpen: 'Öffnen',
		headGeneral: 'Allgemein',
		setTargetFolder: 'Zielordner',
		setTargetFolderDesc: 'Übergeordneter Ordner, in dem der Kongressordner angelegt wird. Leer lassen, damit jeder Kongress direkt als eigener Ordner in der Vault-Wurzel entsteht (kein zusätzlicher Wrapper-Ordner).',
		setTargetFolderPlaceholder: '(Vault-Wurzel)',
		setLang: 'Sprache der Oberfläche und des Bibeltext-Popups',
		setLangDesc: 'Beschriftungen des Plugins und Bibelbuch-Namen im Popup. Notizen folgen automatisch der Sprache der importierten Programmdatei.',
		headScripture: 'Bibelstellen',
		setScriptureLinks: 'Bibelstellen verlinken',
		setScriptureLinksDesc: 'Erzeugt klickbare JW-Library-Links auf jede Bibelstelle.',
		setBiblePopupEnabled: 'Bibeltext-Popup aktivieren',
		setBiblePopupEnabledDesc: 'Öffnet beim Klicken oder Tippen auf eine Bibelstelle den Vers-Text direkt in Obsidian, statt nur JW Library zu öffnen. Lässt sich unabhängig von der geladenen Bibel-Datei abschalten.',
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
		setBibleFile: 'Bibel-Datei',
		bibleDescLoaded: 'Bibel-Datei ist geladen. Ein Klick auf eine Bibelstelle zeigt den Vers-Text direkt in Obsidian an (mit einem Button zum Öffnen in JW Library).',
		bibleDescMissing: 'Optional: eine Bibel-jwpub-Datei auswählen (z. B. von jw.org heruntergeladen), damit ein Klick auf eine Bibelstelle den Vers-Text direkt in Obsidian anzeigt, statt nur JW Library zu öffnen. Die Studienbibel (nwtsty) bietet Studienanmerkungen und mehr Fußnoten; auf Mobilgeräten mit wenig Arbeitsspeicher ist die deutlich kleinere einfache Ausgabe (nwt) die speicherschonendere Wahl. Die Datei wird lokal im Plugin-Ordner gespeichert, nicht ins Vault kopiert.',
		btnChooseFile: 'Datei wählen …',
		btnReplaceFile: 'Datei ersetzen …',
		btnRemoveBible: 'Bibel-Datei entfernen',
		headScriptureSuggest: 'Vorschläge für getippte Bibelstellen',
		headScriptureSuggestDesc: 'Welche Aktionen beim Tippen einer Bibelstelle (z. B. "Psalm 12:1") vorgeschlagen werden, und in welcher Reihenfolge. Deaktivierte Aktionen werden nicht angezeigt.',
		btnMoveUp: 'Nach oben',
		btnMoveDown: 'Nach unten',

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

		legacyModalTitle: 'Mögliche Korrekturen für alte Notizen',
		legacyModalDesc: 'Diese Notizen wurden mit einer Plugin-Version vor 1.9.0 erstellt und haben keine unsichtbaren Marker – deshalb werden hier nur Zeilen vorgeschlagen, die eindeutig einem bekannten Feld zugeordnet werden können. Nur Notizen mit aktiviertem Schalter werden beim Klick auf „Übernehmen" geändert; alles andere in jeder Notiz bleibt unangetastet.',
		noticeLegacyCorrectionsFound: count => `${count} alte Notiz(en) mit möglichen Korrekturen gefunden. (Klicken zum Prüfen)`,
		noticeLegacyApplied: count => `${count} Notiz(en) aktualisiert.`,
		btnApply: 'Übernehmen',
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
		scriptureSuggestLinkAndOpen: 'Link & Open JW Library',
		scriptureSuggestQuoteKeepLink: 'Insert as quote & keep the link',

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

		headImport: 'Import & update convention programs',
		headImportDesc: 'Two ways to bring a convention program in: "Import convention program" creates a new convention folder — re-importing into the same folder only refreshes purely automatically generated files (overview, cover image), notes with your own entries are left untouched. "Update convention notes" instead reconciles an already-imported folder field by field (day, time, scriptures, headings) — even inside notes already edited by hand, without losing anything typed there. Useful e.g. after a plugin update fixes a bug in the notes. For notes from a very old plugin version (with no invisible markers), "Update convention notes" instead offers a review window with proposed corrections that can be confirmed individually.',
		setImportActionDesc: 'Pick a program file and create notes from it (see the explanation above).',
		btnOpen: 'Open',
		headGeneral: 'General',
		setTargetFolder: 'Target folder',
		setTargetFolderDesc: 'Parent folder in which convention folders are created. Leave empty so each convention becomes its own top-level folder in the vault root (no extra wrapper folder).',
		setTargetFolderPlaceholder: '(vault root)',
		setLang: 'Language of the interface and Bible-verse popup',
		setLangDesc: 'Plugin labels and Bible book names in the popup. Notes automatically follow the language of the imported program file.',
		headScripture: 'Scripture references',
		setScriptureLinks: 'Link scriptures',
		setScriptureLinksDesc: 'Generates clickable JW Library links for every scripture.',
		setBiblePopupEnabled: 'Enable Bible-verse popup',
		setBiblePopupEnabledDesc: 'Opens the verse text directly in Obsidian when a scripture is clicked or tapped, instead of only opening JW Library. Can be switched off independently of the loaded Bible file.',
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
		setBibleFile: 'Bible file',
		bibleDescLoaded: 'Bible file is loaded. Clicking a scripture shows the verse text directly in Obsidian (with a button to open it in JW Library).',
		bibleDescMissing: 'Optional: pick a Bible jwpub file (e.g. downloaded from jw.org) so that clicking a scripture shows the verse text directly in Obsidian instead of only opening JW Library. The study edition (nwtsty) offers study notes and more footnotes; on mobile devices with limited memory the much smaller regular edition (nwt) is the memory-friendly choice. The file is stored locally in the plugin folder, not copied into the vault.',
		btnChooseFile: 'Choose file …',
		btnReplaceFile: 'Replace file …',
		btnRemoveBible: 'Remove Bible file',
		headScriptureSuggest: 'Typed scripture suggestions',
		headScriptureSuggestDesc: 'Which actions are suggested while typing a scripture reference (e.g. "Psalm 12:1"), and in what order. Disabled actions are not shown.',
		btnMoveUp: 'Move up',
		btnMoveDown: 'Move down',

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

		legacyModalTitle: 'Possible corrections for old notes',
		legacyModalDesc: 'These notes were created with a plugin version before 1.9.0 and have no invisible markers — so only lines that can be unambiguously matched to a known field are proposed here. Only notes with the toggle enabled are changed when clicking "Apply"; everything else in every note is left untouched.',
		noticeLegacyCorrectionsFound: count => `${count} old note(s) with possible corrections found. (Click to review)`,
		noticeLegacyApplied: count => `${count} note(s) updated.`,
		btnApply: 'Apply',
	},
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

		popupLoading: 'Chargement du texte biblique …',
		popupMissing: 'Aucun texte de verset disponible (ce passage n’est pas indexé dans le fichier biblique chargé).',
		popupLoadFailed: 'Le fichier biblique n’a pas pu être chargé. Le bouton ci-dessous ouvre le passage dans JW Library à la place.',
		popupOpenJwLibrary: 'Ouvrir dans JW Library',
		popupFootnotes: 'Notes',
		popupCrossRefs: 'Références croisées',
		popupStudyNotes: 'Notes d’étude',
		popupVersePrefix: 'Verset',
		popupNoText: '(aucun texte disponible)',
		popupBack: 'Retour au passage précédent',
		popupVerseBefore: '◀ Verset précédent',
		popupVerseAfter: 'Verset suivant ▶',
		popupWholeChapter: 'Chapitre entier',
		btnInsertAsQuote: 'Insérer comme citation',
		noticeVerseInserted: 'Verset inséré comme citation.',
		noticeNoActiveNote: 'Aucune note active où insérer. Veuillez d’abord ouvrir une note.',
		scriptureSuggestLink: 'Lier',
		scriptureSuggestLinkAndOpen: 'Lier et ouvrir JW Library',
		scriptureSuggestQuoteKeepLink: 'Insérer comme citation et conserver le lien',

		noticeUpdated: version => `JW Programme d’assemblée a été mis à jour vers la version ${version}.\n\nLes améliorations apportées aux modèles de notes n’atteignent pas automatiquement les assemblées déjà importées : exécutez « Mettre à jour les notes de l’assemblée » (palette de commandes) avec le même fichier de programme pour les appliquer — ce que vous avez déjà saisi (orateur, notes) est conservé. Seules les notes créées avec une version très ancienne du plugin ne peuvent pas être mises à jour ainsi ; dans ce cas, supprimez le dossier de l’assemblée et réimportez-le.\n\n(Cliquer pour fermer)`,
		noticeBibleSaved: 'Fichier biblique enregistré.',
		noticeBibleMissingOnDevice: 'Le fichier biblique est absent sur cet appareil (les réglages se synchronisent entre les appareils, pas le fichier lui-même). Veuillez le sélectionner à nouveau sous « Fichier biblique » dans les réglages du plugin.',
		noticeBibleLoadFailed: err => `Le fichier biblique n’a pas pu être chargé : ${err}`,
		noticeQuoteNeedsBibleFile: 'Aucun fichier biblique chargé – le texte biblique a été lié à la place. Ajoutez un fichier biblique dans les réglages du plugin pour insérer directement les citations.',
		noticeBibleHint: 'Astuce : ajoutez un fichier jwpub de la Bible (par ex. l’édition d’étude de jw.org) dans les réglages du plugin — un clic sur un texte biblique ouvrira alors le texte du verset avec les références croisées et les notes d’étude directement en popup dans Obsidian. (Cliquer pour ouvrir les réglages)',
		noticeImportFailed: err => `Échec de l’importation : ${err}`,
		noticeRtfFallback: 'Échec de l’analyse du fichier jwpub – recours au RTF.',
		noticeImportProgress: (done, total) => `Importation en cours … ${done}/${total}`,
		noticeImportResult: (folder, created, updated, skipped) => {
			const parts = [`${created} nouvelles`];
			if (updated > 0) parts.push(`${updated} mises à jour`);
			if (skipped > 0) parts.push(`${skipped} ignorées (déjà présentes)`);
			return `« ${folder} » : ${parts.join(', ')}.`;
		},
		noticeImportRolledBack: err => `Échec de l’importation ; les fichiers déjà créés ont été annulés : ${err}`,
		noticePickFileFirst: 'Veuillez d’abord choisir un fichier.',
		noticeOpenOverviewHint: '(Cliquer pour ouvrir l’aperçu)',
		noticeNotAFolder: path => `« ${path} » n’est pas un dossier.`,

		headImport: 'Importer et mettre à jour les programmes d’assemblée',
		headImportDesc: 'Deux façons d’intégrer un programme d’assemblée : « Importer le programme de l’assemblée » crée un nouveau dossier d’assemblée — une réimportation dans le même dossier ne rafraîchit que les fichiers générés purement automatiquement (aperçu, image de couverture), les notes contenant vos propres saisies restent intactes. « Mettre à jour les notes de l’assemblée » réconcilie au contraire un dossier déjà importé champ par champ (jour, heure, textes bibliques, titres) — même à l’intérieur de notes déjà modifiées à la main, sans perdre ce qui y a été saisi. Utile par ex. après une mise à jour du plugin corrigeant une erreur dans les notes. Pour les notes provenant d’une version très ancienne du plugin (sans marqueurs invisibles), « Mettre à jour les notes de l’assemblée » propose à la place une fenêtre de vérification avec des corrections suggérées, à confirmer individuellement.',
		setImportActionDesc: 'Choisit un fichier de programme et crée des notes à partir de celui-ci (voir l’explication ci-dessus).',
		btnOpen: 'Ouvrir',
		headGeneral: 'Général',
		setTargetFolder: 'Dossier cible',
		setTargetFolderDesc: 'Dossier parent dans lequel le dossier de l’assemblée est créé. Laissez vide pour que chaque assemblée devienne son propre dossier de premier niveau à la racine du coffre (sans dossier englobant supplémentaire).',
		setTargetFolderPlaceholder: '(racine du coffre)',
		setLang: 'Langue de l’interface et du popup de texte biblique',
		setLangDesc: 'Libellés du plugin et noms des livres bibliques dans le popup. Les notes suivent automatiquement la langue du fichier de programme importé.',
		headScripture: 'Textes bibliques',
		setScriptureLinks: 'Lier les textes bibliques',
		setScriptureLinksDesc: 'Génère des liens JW Library cliquables pour chaque texte biblique.',
		setBiblePopupEnabled: 'Activer le popup de texte biblique',
		setBiblePopupEnabledDesc: 'Ouvre le texte du verset directement dans Obsidian lorsqu’un texte biblique est cliqué ou touché, au lieu d’ouvrir seulement JW Library. Peut être désactivé indépendamment du fichier biblique chargé.',
		setReviewNote: 'Créer une note de révision',
		setReviewNoteDesc: 'Crée en plus une note « Révision » avec les trois questions de réflexion standard (pour les assemblées de circonscription avec un lien vers les questions de révision imprimées, pour les assemblées régionales avec une mention de la vidéo des moments forts).',
		headNoteFields: 'Champs de la note',
		setShowDay: 'Afficher le champ « Jour »',
		setShowDayDesc: 'Pertinent uniquement pour les assemblées régionales (les assemblées de circonscription durent un jour).',
		setShowTime: 'Afficher le champ « Heure »',
		setShowScriptures: 'Afficher le champ « Textes bibliques »',
		setShowSpeaker: 'Afficher le champ « Orateur »',
		setExtraFields: 'Champs supplémentaires',
		setExtraFieldsDesc: 'Chaque ligne est ajoutée à chaque note de point de programme comme champ à part entière, avec son propre espace d’écriture (par ex. « **Notes :** »).',
		setFrontmatter: 'Ajouter le frontmatter (propriétés)',
		setFrontmatterDesc: 'Ajoute à chaque note générée un frontmatter YAML avec des clés anglaises stables (convention, type, day, time) – par ex. pour les requêtes Dataview. Les clés sont volontairement indépendantes de la langue.',
		setBibleFile: 'Fichier biblique',
		bibleDescLoaded: 'Le fichier biblique est chargé. Un clic sur un texte biblique affiche le texte du verset directement dans Obsidian (avec un bouton pour l’ouvrir dans JW Library).',
		bibleDescMissing: 'Facultatif : choisissez un fichier jwpub de la Bible (par ex. téléchargé depuis jw.org) pour qu’un clic sur un texte biblique affiche le texte du verset directement dans Obsidian, au lieu d’ouvrir seulement JW Library. L’édition d’étude (nwtsty) propose des notes d’étude et davantage de notes ; sur les appareils mobiles à mémoire limitée, l’édition courante (nwt), bien plus légère, est le choix le plus économe en mémoire. Le fichier est enregistré localement dans le dossier du plugin, pas copié dans le coffre.',
		btnChooseFile: 'Choisir un fichier …',
		btnReplaceFile: 'Remplacer le fichier …',
		btnRemoveBible: 'Supprimer le fichier biblique',
		headScriptureSuggest: 'Suggestions lors de la saisie des textes bibliques',
		headScriptureSuggestDesc: 'Quelles actions sont suggérées lors de la saisie d’un texte biblique (par ex. « Psaume 12:1 ») et dans quel ordre. Les actions désactivées ne sont pas affichées.',
		btnMoveUp: 'Monter',
		btnMoveDown: 'Descendre',

		importTitle: 'Importer le programme de l’assemblée',
		importCommand: 'Importer le programme de l’assemblée',
		importFileName: 'Fichier de programme',
		importFileDesc: 'Choisissez un fichier .jwpub ou un ZIP RTF.',
		btnPickFile: 'Choisir un fichier …',
		importTarget: 'Dossier cible',
		importTargetDesc: 'Par défaut : racine du coffre – l’assemblée est créée directement comme son propre dossier, sans dossier englobant. Vous pouvez aussi choisir un dossier existant ou en créer un nouveau.',
		optVaultRoot: 'Racine du coffre (aucun sous-dossier)',
		optNewFolder: '➕ Nouveau dossier …',
		importNewFolder: 'Nom du nouveau dossier',
		importNewFolderPlaceholder: 'par ex. Assemblées',
		btnImport: 'Importer',
		btnCancel: 'Annuler',
		previewHeading: 'Aperçu',
		previewFailed: err => `Aperçu impossible : ${err}`,
		rowType: 'Type',
		rowTheme: 'Thème',
		rowYear: 'Année',
		rowDays: 'Jours',
		rowSource: 'Source',
		rowSourceRtf: 'RTF (secours)',
		rowItems: 'Points du programme',
		rowLanguage: 'Langue',
		langDisplay: lang => LANG_DISPLAY_NAMES[lang].fr,
		typeLabels: {
			'CO': 'Assemblée régionale',
			'CA-copgm': 'Assemblée de circonscription (responsable de circonscription)',
			'CA-brpgm': 'Assemblée de circonscription (représentant de la filiale)',
		},

		updateCommand: 'Mettre à jour les notes de l’assemblée',
		updateTitle: 'Mettre à jour les notes de l’assemblée',
		updateExplanation: 'Choisissez à nouveau le même fichier de programme et comparez-le à un dossier d’assemblée déjà importé — utile après une mise à jour du plugin qui corrige une erreur dans les notes (par ex. jour, heure ou textes bibliques). Tout ce que vous avez déjà saisi (nom de l’orateur, notes personnelles) reste intact ; seuls les champs générés automatiquement sont rafraîchis.',
		updateTargetFolder: 'Dossier d’assemblée à mettre à jour',
		updateTargetFolderDesc: 'Le dossier créé par l’importation d’origine.',
		updateNoFoldersFound: 'Aucun dossier trouvé dans le coffre.',
		btnUpdate: 'Mettre à jour',
		noticeUpdateFolderNotFound: path => `Le dossier « ${path} » est introuvable.`,
		noticeUpdateResult: (merged, created, needsReimport, unchanged) => {
			const parts = [`${merged} mises à jour`];
			if (created > 0) parts.push(`${created} nouvellement créées`);
			if (unchanged > 0) parts.push(`${unchanged} déjà à jour`);
			if (needsReimport > 0) parts.push(`${needsReimport} nécessitent une réimportation complète (ancien format)`);
			return `Mise à jour terminée : ${parts.join(', ')}.`;
		},

		legacyModalTitle: 'Corrections possibles pour les anciennes notes',
		legacyModalDesc: 'Ces notes ont été créées avec une version du plugin antérieure à la 1.9.0 et ne contiennent aucun marqueur invisible — seules les lignes pouvant être associées sans ambiguïté à un champ connu sont donc proposées ici. Seules les notes dont l’interrupteur est activé sont modifiées en cliquant sur « Appliquer » ; tout le reste de chaque note reste inchangé.',
		noticeLegacyCorrectionsFound: count => `${count} ancienne(s) note(s) avec des corrections possibles trouvée(s). (Cliquer pour vérifier)`,
		noticeLegacyApplied: count => `${count} note(s) mise(s) à jour.`,
		btnApply: 'Appliquer',
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

		popupLoading: 'Caricamento del testo biblico …',
		popupMissing: 'Nessun testo del versetto disponibile (questo passo non è indicizzato nel file della Bibbia caricato).',
		popupLoadFailed: 'Non è stato possibile caricare il file della Bibbia. Il pulsante qui sotto apre il passo in JW Library.',
		popupOpenJwLibrary: 'Apri in JW Library',
		popupFootnotes: 'Note in calce',
		popupCrossRefs: 'Riferimenti incrociati',
		popupStudyNotes: 'Approfondimenti',
		popupVersePrefix: 'Versetto',
		popupNoText: '(nessun testo disponibile)',
		popupBack: 'Torna al passo precedente',
		popupVerseBefore: '◀ Versetto precedente',
		popupVerseAfter: 'Versetto successivo ▶',
		popupWholeChapter: 'Capitolo intero',
		btnInsertAsQuote: 'Inserisci come citazione',
		noticeVerseInserted: 'Versetto inserito come citazione.',
		noticeNoActiveNote: 'Nessuna nota attiva in cui inserire. Apri prima una nota.',
		scriptureSuggestLink: 'Collega',
		scriptureSuggestLinkAndOpen: 'Collega e apri JW Library',
		scriptureSuggestQuoteKeepLink: 'Inserisci come citazione e mantieni il collegamento',

		noticeUpdated: version => `JW Programma del congresso è stato aggiornato alla versione ${version}.\n\nI miglioramenti ai modelli di nota non raggiungono automaticamente i congressi già importati: esegui "Aggiorna le note del congresso" (palette dei comandi) con lo stesso file del programma per applicarli — quanto hai già scritto (oratore, note) viene mantenuto. Solo le note create con una versione molto vecchia del plugin non possono essere aggiornate in questo modo; in tal caso elimina la cartella del congresso e reimportala.\n\n(Clicca per chiudere)`,
		noticeBibleSaved: 'File della Bibbia salvato.',
		noticeBibleMissingOnDevice: 'Il file della Bibbia non è presente su questo dispositivo (le impostazioni si sincronizzano tra i dispositivi, il file stesso no). Selezionalo di nuovo in "File della Bibbia" nelle impostazioni del plugin.',
		noticeBibleLoadFailed: err => `Non è stato possibile caricare il file della Bibbia: ${err}`,
		noticeQuoteNeedsBibleFile: 'Nessun file della Bibbia caricato – il testo biblico è stato collegato invece. Aggiungi un file della Bibbia nelle impostazioni del plugin per inserire le citazioni direttamente.',
		noticeBibleHint: 'Suggerimento: aggiungi un file jwpub della Bibbia (ad es. l’edizione di studio da jw.org) nelle impostazioni del plugin — un clic su un testo biblico aprirà quindi il testo del versetto con riferimenti incrociati e approfondimenti direttamente come popup in Obsidian. (Clicca per aprire le impostazioni)',
		noticeImportFailed: err => `Importazione non riuscita: ${err}`,
		noticeRtfFallback: 'Analisi del file jwpub non riuscita – utilizzato il fallback RTF.',
		noticeImportProgress: (done, total) => `Importazione in corso … ${done}/${total}`,
		noticeImportResult: (folder, created, updated, skipped) => {
			const parts = [`${created} nuovi`];
			if (updated > 0) parts.push(`${updated} aggiornati`);
			if (skipped > 0) parts.push(`${skipped} saltati (già presenti)`);
			return `"${folder}": ${parts.join(', ')}.`;
		},
		noticeImportRolledBack: err => `Importazione non riuscita; i file creati finora sono stati annullati: ${err}`,
		noticePickFileFirst: 'Seleziona prima un file.',
		noticeOpenOverviewHint: '(Clicca per aprire la panoramica)',
		noticeNotAFolder: path => `"${path}" non è una cartella.`,

		headImport: 'Importa e aggiorna i programmi dei congressi',
		headImportDesc: 'Due modi per importare un programma di congresso: "Importa programma del congresso" crea una nuova cartella del congresso — un nuovo import nella stessa cartella aggiorna solo i file generati automaticamente (panoramica, immagine di copertina), le note con voci personali restano intatte. "Aggiorna le note del congresso" invece riconcilia una cartella già importata campo per campo (giorno, ora, testi biblici, titoli) — anche all’interno di note già modificate a mano, senza perdere nulla di quanto scritto. Utile ad es. dopo un aggiornamento del plugin che corregge un errore nelle note. Per le note create con una versione molto vecchia del plugin (senza marcatori invisibili), "Aggiorna le note del congresso" offre invece una finestra di verifica con correzioni proposte, da confermare singolarmente.',
		setImportActionDesc: 'Seleziona un file del programma e crea le note a partire da esso (vedi la spiegazione sopra).',
		btnOpen: 'Apri',
		headGeneral: 'Generale',
		setTargetFolder: 'Cartella di destinazione',
		setTargetFolderDesc: 'Cartella principale in cui vengono create le cartelle dei congressi. Lascia vuoto in modo che ogni congresso diventi una propria cartella di primo livello nella radice del vault (senza cartella contenitore aggiuntiva).',
		setTargetFolderPlaceholder: '(radice del vault)',
		setLang: 'Lingua dell’interfaccia e del popup dei versetti biblici',
		setLangDesc: 'Le etichette del plugin e i nomi dei libri biblici nel popup. Le note seguono automaticamente la lingua del file del programma importato.',
		headScripture: 'Testi biblici',
		setScriptureLinks: 'Collega i testi biblici',
		setScriptureLinksDesc: 'Genera link cliccabili di JW Library per ogni testo biblico.',
		setBiblePopupEnabled: 'Attiva il popup dei versetti biblici',
		setBiblePopupEnabledDesc: 'Apre il testo del versetto direttamente in Obsidian quando si clicca o si tocca un testo biblico, invece di aprire solo JW Library. Può essere disattivato indipendentemente dal file della Bibbia caricato.',
		setReviewNote: 'Crea nota di ripasso',
		setReviewNoteDesc: 'Crea inoltre una nota "Ripasso" con le tre domande di riflessione standard (per le assemblee di circoscrizione con link alle domande di ripasso stampate, per i congressi regionali con menzione del video con i momenti salienti).',
		headNoteFields: 'Campi della nota',
		setShowDay: 'Mostra il campo "Giorno"',
		setShowDayDesc: 'Rilevante solo per i congressi regionali (le assemblee di circoscrizione durano un giorno).',
		setShowTime: 'Mostra il campo "Ora"',
		setShowScriptures: 'Mostra il campo "Testi biblici"',
		setShowSpeaker: 'Mostra il campo "Oratore"',
		setExtraFields: 'Campi aggiuntivi',
		setExtraFieldsDesc: 'Ogni riga viene aggiunta a ogni nota di un punto del programma come campo a sé, con il proprio spazio per scrivere (ad es. "**Note:**").',
		setFrontmatter: 'Aggiungi il frontmatter (proprietà)',
		setFrontmatterDesc: 'Aggiunge a ogni nota generata un frontmatter YAML con chiavi inglesi stabili (convention, type, day, time) – ad es. per le query di Dataview. Le chiavi sono volutamente indipendenti dalla lingua.',
		setBibleFile: 'File della Bibbia',
		bibleDescLoaded: 'Il file della Bibbia è caricato. Un clic su un testo biblico mostra il testo del versetto direttamente in Obsidian (con un pulsante per aprirlo in JW Library).',
		bibleDescMissing: 'Facoltativo: seleziona un file jwpub della Bibbia (ad es. scaricato da jw.org) in modo che un clic su un testo biblico mostri il testo del versetto direttamente in Obsidian, invece di aprire solo JW Library. L’edizione di studio (nwtsty) offre approfondimenti e più note in calce; sui dispositivi mobili con poca memoria l’edizione normale (nwt), molto più piccola, è la scelta più adatta. Il file viene salvato localmente nella cartella del plugin, non copiato nel vault.',
		btnChooseFile: 'Scegli file …',
		btnReplaceFile: 'Sostituisci file …',
		btnRemoveBible: 'Rimuovi il file della Bibbia',
		headScriptureSuggest: 'Suggerimenti durante la digitazione dei testi biblici',
		headScriptureSuggestDesc: 'Quali azioni vengono suggerite durante la digitazione di un testo biblico (ad es. "Salmo 12:1") e in quale ordine. Le azioni disattivate non vengono mostrate.',
		btnMoveUp: 'Sposta su',
		btnMoveDown: 'Sposta giù',

		importTitle: 'Importa programma del congresso',
		importCommand: 'Importa programma del congresso',
		importFileName: 'File del programma',
		importFileDesc: 'Seleziona un file .jwpub o uno ZIP RTF.',
		btnPickFile: 'Scegli file …',
		importTarget: 'Cartella di destinazione',
		importTargetDesc: 'Predefinito: radice del vault – il congresso viene creato direttamente come propria cartella, senza cartella contenitore. In alternativa, seleziona una cartella esistente o creane una nuova.',
		optVaultRoot: 'Radice del vault (nessuna sottocartella)',
		optNewFolder: '➕ Nuova cartella …',
		importNewFolder: 'Nome della nuova cartella',
		importNewFolderPlaceholder: 'ad es. Congressi',
		btnImport: 'Importa',
		btnCancel: 'Annulla',
		previewHeading: 'Anteprima',
		previewFailed: err => `Anteprima non disponibile: ${err}`,
		rowType: 'Tipo',
		rowTheme: 'Tema',
		rowYear: 'Anno',
		rowDays: 'Giorni',
		rowSource: 'Fonte',
		rowSourceRtf: 'RTF (fallback)',
		rowItems: 'Punti del programma',
		rowLanguage: 'Lingua',
		langDisplay: lang => LANG_DISPLAY_NAMES[lang].it,
		typeLabels: {
			'CO': 'Congresso regionale',
			'CA-copgm': 'Assemblea di circoscrizione (sorvegliante di circoscrizione)',
			'CA-brpgm': 'Assemblea di circoscrizione (rappresentante della filiale)',
		},

		updateCommand: 'Aggiorna le note del congresso',
		updateTitle: 'Aggiorna le note del congresso',
		updateExplanation: 'Seleziona di nuovo lo stesso file del programma e confrontalo con una cartella del congresso già importata — utile dopo un aggiornamento del plugin che corregge un errore nelle note (ad es. giorno, ora o testi biblici). Tutto ciò che hai già scritto (nome dell’oratore, note personali) resta intatto; vengono aggiornati solo i campi generati automaticamente.',
		updateTargetFolder: 'Cartella del congresso da aggiornare',
		updateTargetFolderDesc: 'La cartella creata dall’importazione originale.',
		updateNoFoldersFound: 'Nessuna cartella trovata nel vault.',
		btnUpdate: 'Aggiorna',
		noticeUpdateFolderNotFound: path => `La cartella "${path}" non è stata trovata.`,
		noticeUpdateResult: (merged, created, needsReimport, unchanged) => {
			const parts = [`${merged} aggiornate`];
			if (created > 0) parts.push(`${created} create`);
			if (unchanged > 0) parts.push(`${unchanged} già aggiornate`);
			if (needsReimport > 0) parts.push(`${needsReimport} richiedono una reimportazione completa (formato più vecchio)`);
			return `Aggiornamento completato: ${parts.join(', ')}.`;
		},

		legacyModalTitle: 'Possibili correzioni per le note vecchie',
		legacyModalDesc: 'Queste note sono state create con una versione del plugin precedente alla 1.9.0 e non contengono marcatori invisibili — vengono quindi proposte solo le righe che possono essere associate senza ambiguità a un campo noto. Vengono modificate solo le note con l’interruttore attivo, cliccando su "Applica"; tutto il resto di ogni nota resta invariato.',
		noticeLegacyCorrectionsFound: count => `Trovate ${count} nota/e vecchia/e con possibili correzioni. (Clicca per controllare)`,
		noticeLegacyApplied: count => `${count} nota/e aggiornata/e.`,
		btnApply: 'Applica',
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

		popupLoading: 'Carregando o texto bíblico …',
		popupMissing: 'Nenhum texto do versículo disponível (esta passagem não está indexada no arquivo da Bíblia carregado).',
		popupLoadFailed: 'Não foi possível carregar o arquivo da Bíblia. O botão abaixo abre a passagem no JW Library.',
		popupOpenJwLibrary: 'Abrir no JW Library',
		popupFootnotes: 'Notas de rodapé',
		popupCrossRefs: 'Referências cruzadas',
		popupStudyNotes: 'Notas de estudo',
		popupVersePrefix: 'Versículo',
		popupNoText: '(nenhum texto disponível)',
		popupBack: 'Voltar à passagem anterior',
		popupVerseBefore: '◀ Versículo anterior',
		popupVerseAfter: 'Versículo seguinte ▶',
		popupWholeChapter: 'Capítulo inteiro',
		btnInsertAsQuote: 'Inserir como citação',
		noticeVerseInserted: 'Versículo inserido como citação.',
		noticeNoActiveNote: 'Nenhuma nota ativa para inserir. Abra primeiro uma nota.',
		scriptureSuggestLink: 'Vincular',
		scriptureSuggestLinkAndOpen: 'Vincular e abrir no JW Library',
		scriptureSuggestQuoteKeepLink: 'Inserir como citação e manter o link',

		noticeUpdated: version => `O JW Programa do Congresso foi atualizado para a versão ${version}.\n\nAs melhorias nos modelos de nota não chegam automaticamente aos congressos já importados: execute "Atualizar as notas do congresso" (paleta de comandos) com o mesmo arquivo do programa para aplicá-las — tudo o que você já escreveu (orador, notas) é mantido. Somente notas criadas com uma versão muito antiga do plugin não podem ser atualizadas dessa forma; nesse caso, exclua a pasta do congresso e reimporte-a.\n\n(Clique para fechar)`,
		noticeBibleSaved: 'Arquivo da Bíblia salvo.',
		noticeBibleMissingOnDevice: 'O arquivo da Bíblia não está presente neste dispositivo (as configurações são sincronizadas entre dispositivos, mas o arquivo em si não). Selecione-o novamente em "Arquivo da Bíblia" nas configurações do plugin.',
		noticeBibleLoadFailed: err => `Não foi possível carregar o arquivo da Bíblia: ${err}`,
		noticeQuoteNeedsBibleFile: 'Nenhum arquivo da Bíblia carregado – o texto bíblico foi vinculado em vez disso. Adicione um arquivo da Bíblia nas configurações do plugin para inserir as citações diretamente.',
		noticeBibleHint: 'Dica: adicione um arquivo jwpub da Bíblia (por ex. a edição de estudo de jw.org) nas configurações do plugin — um clique em um texto bíblico abrirá o texto do versículo com referências cruzadas e notas de estudo diretamente em um popup no Obsidian. (Clique para abrir as configurações)',
		noticeImportFailed: err => `Falha na importação: ${err}`,
		noticeRtfFallback: 'Falha ao analisar o arquivo jwpub – usado o fallback RTF.',
		noticeImportProgress: (done, total) => `Importando … ${done}/${total}`,
		noticeImportResult: (folder, created, updated, skipped) => {
			const parts = [`${created} novos`];
			if (updated > 0) parts.push(`${updated} atualizados`);
			if (skipped > 0) parts.push(`${skipped} ignorados (já existentes)`);
			return `"${folder}": ${parts.join(', ')}.`;
		},
		noticeImportRolledBack: err => `Falha na importação; os arquivos criados até agora foram desfeitos: ${err}`,
		noticePickFileFirst: 'Selecione um arquivo primeiro.',
		noticeOpenOverviewHint: '(Clique para abrir a visão geral)',
		noticeNotAFolder: path => `"${path}" não é uma pasta.`,

		headImport: 'Importar e atualizar programas de congresso',
		headImportDesc: 'Duas formas de importar um programa de congresso: "Importar programa do congresso" cria uma nova pasta de congresso — uma nova importação na mesma pasta atualiza apenas os arquivos gerados automaticamente (visão geral, imagem de capa); notas com anotações próprias permanecem intactas. "Atualizar as notas do congresso", por sua vez, reconcilia uma pasta já importada campo por campo (dia, hora, textos bíblicos, títulos) — mesmo dentro de notas já editadas manualmente, sem perder nada do que foi escrito. Útil, por exemplo, após uma atualização do plugin que corrige um erro nas notas. Para notas de uma versão muito antiga do plugin (sem marcadores invisíveis), "Atualizar as notas do congresso" oferece, em vez disso, uma janela de revisão com correções propostas, que podem ser confirmadas individualmente.',
		setImportActionDesc: 'Selecione um arquivo do programa e crie as notas a partir dele (veja a explicação acima).',
		btnOpen: 'Abrir',
		headGeneral: 'Geral',
		setTargetFolder: 'Pasta de destino',
		setTargetFolderDesc: 'Pasta principal onde as pastas dos congressos são criadas. Deixe em branco para que cada congresso se torne sua própria pasta de nível superior na raiz do vault (sem pasta contentora adicional).',
		setTargetFolderPlaceholder: '(raiz do vault)',
		setLang: 'Idioma da interface e do popup de versículos bíblicos',
		setLangDesc: 'Rótulos do plugin e nomes dos livros bíblicos no popup. As notas seguem automaticamente o idioma do arquivo do programa importado.',
		headScripture: 'Textos bíblicos',
		setScriptureLinks: 'Vincular textos bíblicos',
		setScriptureLinksDesc: 'Gera links clicáveis do JW Library para cada texto bíblico.',
		setBiblePopupEnabled: 'Ativar popup de versículos bíblicos',
		setBiblePopupEnabledDesc: 'Abre o texto do versículo diretamente no Obsidian ao clicar ou tocar em um texto bíblico, em vez de abrir apenas o JW Library. Pode ser desativado independentemente do arquivo da Bíblia carregado.',
		setReviewNote: 'Criar nota de revisão',
		setReviewNoteDesc: 'Cria adicionalmente uma nota "Revisão" com as três perguntas de reflexão padrão (para assembleias de circuito com link para as perguntas de revisão impressas; para congressos regionais com menção ao vídeo com os destaques).',
		headNoteFields: 'Campos da nota',
		setShowDay: 'Mostrar campo "Dia"',
		setShowDayDesc: 'Relevante apenas para congressos regionais (as assembleias de circuito duram um dia).',
		setShowTime: 'Mostrar campo "Hora"',
		setShowScriptures: 'Mostrar campo "Textos bíblicos"',
		setShowSpeaker: 'Mostrar campo "Orador"',
		setExtraFields: 'Campos adicionais',
		setExtraFieldsDesc: 'Cada linha é adicionada a toda nota de um ponto do programa como um campo próprio, com seu próprio espaço para escrever (por ex. "**Notas:**").',
		setFrontmatter: 'Adicionar frontmatter (propriedades)',
		setFrontmatterDesc: 'Adiciona a cada nota gerada um frontmatter YAML com chaves fixas em inglês (convention, type, day, time) – por ex. para consultas do Dataview. As chaves são propositalmente independentes do idioma.',
		setBibleFile: 'Arquivo da Bíblia',
		bibleDescLoaded: 'O arquivo da Bíblia está carregado. Clicar em um texto bíblico mostra o texto do versículo diretamente no Obsidian (com um botão para abri-lo no JW Library).',
		bibleDescMissing: 'Opcional: selecione um arquivo jwpub da Bíblia (por ex. baixado de jw.org) para que, ao clicar em um texto bíblico, o texto do versículo seja exibido diretamente no Obsidian, em vez de abrir apenas o JW Library. A edição de estudo (nwtsty) oferece notas de estudo e mais notas de rodapé; em dispositivos móveis com pouca memória, a edição normal (nwt), bem menor, é a escolha mais adequada. O arquivo é salvo localmente na pasta do plugin, não é copiado para o vault.',
		btnChooseFile: 'Escolher arquivo …',
		btnReplaceFile: 'Substituir arquivo …',
		btnRemoveBible: 'Remover arquivo da Bíblia',
		headScriptureSuggest: 'Sugestões ao digitar textos bíblicos',
		headScriptureSuggestDesc: 'Quais ações são sugeridas ao digitar uma referência bíblica (por ex. "Salmo 12:1") e em que ordem. As ações desativadas não são exibidas.',
		btnMoveUp: 'Mover para cima',
		btnMoveDown: 'Mover para baixo',

		importTitle: 'Importar programa do congresso',
		importCommand: 'Importar programa do congresso',
		importFileName: 'Arquivo do programa',
		importFileDesc: 'Selecione um arquivo .jwpub ou um ZIP RTF.',
		btnPickFile: 'Escolher arquivo …',
		importTarget: 'Pasta de destino',
		importTargetDesc: 'Padrão: raiz do vault – o congresso é criado diretamente como sua própria pasta, sem pasta contentora. Como alternativa, selecione uma pasta existente ou crie uma nova.',
		optVaultRoot: 'Raiz do vault (sem subpasta)',
		optNewFolder: '➕ Nova pasta …',
		importNewFolder: 'Nome da nova pasta',
		importNewFolderPlaceholder: 'por ex. Congressos',
		btnImport: 'Importar',
		btnCancel: 'Cancelar',
		previewHeading: 'Pré-visualização',
		previewFailed: err => `Pré-visualização não disponível: ${err}`,
		rowType: 'Tipo',
		rowTheme: 'Tema',
		rowYear: 'Ano',
		rowDays: 'Dias',
		rowSource: 'Fonte',
		rowSourceRtf: 'RTF (fallback)',
		rowItems: 'Pontos do programa',
		rowLanguage: 'Idioma',
		langDisplay: lang => LANG_DISPLAY_NAMES[lang].pt,
		typeLabels: {
			'CO': 'Congresso regional',
			'CA-copgm': 'Assembleia de Circuito (Superintendente de Circuito)',
			'CA-brpgm': 'Assembleia de Circuito (Representante da Filial)',
		},

		updateCommand: 'Atualizar as notas do congresso',
		updateTitle: 'Atualizar as notas do congresso',
		updateExplanation: 'Selecione novamente o mesmo arquivo do programa e compare-o com uma pasta de congresso já importada — útil após uma atualização do plugin que corrige um erro nas notas (por ex. dia, hora ou textos bíblicos). Tudo o que você já escreveu (nome do orador, notas pessoais) permanece intacto; apenas os campos gerados automaticamente são atualizados.',
		updateTargetFolder: 'Pasta do congresso a atualizar',
		updateTargetFolderDesc: 'A pasta criada pela importação original.',
		updateNoFoldersFound: 'Nenhuma pasta encontrada no vault.',
		btnUpdate: 'Atualizar',
		noticeUpdateFolderNotFound: path => `A pasta "${path}" não foi encontrada.`,
		noticeUpdateResult: (merged, created, needsReimport, unchanged) => {
			const parts = [`${merged} atualizadas`];
			if (created > 0) parts.push(`${created} criadas`);
			if (unchanged > 0) parts.push(`${unchanged} já atualizadas`);
			if (needsReimport > 0) parts.push(`${needsReimport} exigem uma reimportação completa (formato mais antigo)`);
			return `Atualização concluída: ${parts.join(', ')}.`;
		},

		legacyModalTitle: 'Possíveis correções para notas antigas',
		legacyModalDesc: 'Estas notas foram criadas com uma versão do plugin anterior à 1.9.0 e não têm marcadores invisíveis — por isso, só são propostas aqui linhas que possam ser associadas sem ambiguidade a um campo conhecido. Apenas as notas com a chave ativada são alteradas ao clicar em "Aplicar"; todo o resto de cada nota permanece intocado.',
		noticeLegacyCorrectionsFound: count => `${count} nota(s) antiga(s) com possíveis correções encontrada(s). (Clique para revisar)`,
		noticeLegacyApplied: count => `${count} nota(s) atualizada(s).`,
		btnApply: 'Aplicar',
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

		popupLoading: 'Загрузка текста Библии…',
		popupMissing: 'Текст стиха недоступен (этот отрывок не проиндексирован в загруженном файле Библии).',
		popupLoadFailed: 'Не удалось загрузить файл Библии. Кнопка ниже откроет отрывок в JW Library.',
		popupOpenJwLibrary: 'Открыть в JW Library',
		popupFootnotes: 'Сноски',
		popupCrossRefs: 'Перекрёстные ссылки',
		popupStudyNotes: 'Учебные примечания',
		popupVersePrefix: 'Стих',
		popupNoText: '(текст недоступен)',
		popupBack: 'Вернуться к предыдущему отрывку',
		popupVerseBefore: '◀ Предыдущий стих',
		popupVerseAfter: 'Следующий стих ▶',
		popupWholeChapter: 'Вся глава',
		btnInsertAsQuote: 'Вставить как цитату',
		noticeVerseInserted: 'Стих вставлен как цитата.',
		noticeNoActiveNote: 'Нет активной заметки для вставки. Сначала откройте заметку.',
		scriptureSuggestLink: 'Ссылка',
		scriptureSuggestLinkAndOpen: 'Ссылка и открытие JW Library',
		scriptureSuggestQuoteKeepLink: 'Вставить как цитату и сохранить ссылку',

		noticeUpdated: version => `Плагин JW Convention Program обновлён до версии ${version}.\n\nУлучшения шаблонов заметок не применяются к уже импортированным конгрессам автоматически: чтобы получить их, выполните команду «Обновить заметки конгресса» (палитра команд) с тем же файлом программы — всё, что вы уже вписали (докладчик, заметки), сохранится. Только заметки из очень старой версии плагина нельзя обновить таким способом — для них удалите папку конгресса и импортируйте заново.\n\n(Нажмите, чтобы закрыть)`,
		noticeBibleSaved: 'Файл Библии сохранён.',
		noticeBibleMissingOnDevice: 'Файл Библии отсутствует на этом устройстве (настройки синхронизируются между устройствами, а сам файл — нет). Выберите его заново в разделе «Файл Библии» в настройках плагина.',
		noticeBibleLoadFailed: err => `Не удалось загрузить файл Библии: ${err}`,
		noticeQuoteNeedsBibleFile: 'Файл Библии не загружен — вместо цитаты добавлена ссылка. Чтобы вставлять цитаты напрямую, добавьте файл Библии в настройках плагина.',
		noticeBibleHint: 'Совет: добавьте файл Библии в формате jwpub (например, исследовательское издание с jw.org) в настройках плагина — тогда при нажатии на библейский текст будет открываться всплывающее окно прямо в Obsidian с текстом стиха, перекрёстными ссылками и учебными примечаниями. (Нажмите, чтобы открыть настройки)',
		noticeImportFailed: err => `Не удалось выполнить импорт: ${err}`,
		noticeRtfFallback: 'Не удалось обработать файл jwpub — использован резервный вариант RTF.',
		noticeImportProgress: (done, total) => `Импорт… ${done}/${total}`,
		noticeImportResult: (folder, created, updated, skipped) => {
			const parts = [`новых: ${created}`];
			if (updated > 0) parts.push(`обновлено: ${updated}`);
			if (skipped > 0) parts.push(`пропущено (уже есть): ${skipped}`);
			return `«${folder}»: ${parts.join(', ')}.`;
		},
		noticeImportRolledBack: err => `Импорт не удался; уже созданные файлы были отменены: ${err}`,
		noticePickFileFirst: 'Сначала выберите файл.',
		noticeOpenOverviewHint: '(Нажмите, чтобы открыть обзор)',
		noticeNotAFolder: path => `«${path}» не является папкой.`,

		headImport: 'Импорт и обновление программ конгрессов',
		headImportDesc: 'Есть два способа добавить программу конгресса: команда «Импортировать программу конгресса» создаёт новую папку конгресса — повторный импорт в ту же папку обновляет только полностью автоматически создаваемые файлы (обзор, обложка), а заметки с вашими собственными записями остаются нетронутыми. Команда «Обновить заметки конгресса», напротив, сверяет уже импортированную папку поле за полем (день, время, библейские тексты, заголовки) — даже внутри заметок, отредактированных вручную, ничего из вписанного туда не теряется. Это полезно, например, после того как обновление плагина исправляет ошибку в заметках. Для заметок из очень старой версии плагина (без невидимых маркеров) команда «Обновить заметки конгресса» вместо этого предлагает окно проверки с предложенными исправлениями, которые можно подтвердить по отдельности.',
		setImportActionDesc: 'Выберите файл программы и создайте на его основе заметки (см. пояснение выше).',
		btnOpen: 'Открыть',
		headGeneral: 'Общее',
		setTargetFolder: 'Целевая папка',
		setTargetFolderDesc: 'Родительская папка, в которой создаются папки конгрессов. Оставьте поле пустым, чтобы каждый конгресс становился отдельной папкой верхнего уровня в корне хранилища (без дополнительной папки-обёртки).',
		setTargetFolderPlaceholder: '(корень хранилища)',
		setLang: 'Язык интерфейса и всплывающего окна с библейским текстом',
		setLangDesc: 'Надписи плагина и названия книг Библии во всплывающем окне. Заметки автоматически используют язык импортированного файла программы.',
		headScripture: 'Библейские тексты',
		setScriptureLinks: 'Ссылки на библейские тексты',
		setScriptureLinksDesc: 'Создаёт кликабельные ссылки JW Library для каждого библейского текста.',
		setBiblePopupEnabled: 'Включить всплывающее окно с библейским текстом',
		setBiblePopupEnabledDesc: 'Открывает текст стиха прямо в Obsidian при нажатии на библейский текст, вместо того чтобы просто открывать JW Library. Можно отключить независимо от того, загружен ли файл Библии.',
		setReviewNote: 'Создавать заметку «Повторение»',
		setReviewNoteDesc: 'Дополнительно создаёт заметку «Повторение» с тремя стандартными вопросами для размышления (для районных конгрессов добавляется ссылка на напечатанные вопросы для повторения, для конгрессов — упоминание видео с отрывками программы).',
		headNoteFields: 'Поля заметок',
		setShowDay: 'Показывать поле «День»',
		setShowDayDesc: 'Актуально только для конгрессов (районные конгрессы проходят один день).',
		setShowTime: 'Показывать поле «Время»',
		setShowScriptures: 'Показывать поле «Библейские тексты»',
		setShowSpeaker: 'Показывать поле «Докладчик»',
		setExtraFields: 'Дополнительные поля',
		setExtraFieldsDesc: 'Каждая строка добавляется в заметку каждого пункта программы как отдельное поле со своим местом для записей (например, «**Заметки:**»).',
		setFrontmatter: 'Добавлять фронтматтер (свойства)',
		setFrontmatterDesc: 'Добавляет YAML-фронтматтер с неизменными английскими ключами (convention, type, day, time) в каждую создаваемую заметку — например, для запросов Dataview. Ключи намеренно не зависят от языка.',
		setBibleFile: 'Файл Библии',
		bibleDescLoaded: 'Файл Библии загружен. При нажатии на библейский текст текст стиха отображается прямо в Obsidian (с кнопкой для открытия в JW Library).',
		bibleDescMissing: 'Необязательно: выберите файл Библии в формате jwpub (например, скачанный с jw.org), чтобы при нажатии на библейский текст его текст отображался прямо в Obsidian, а не только открывался в JW Library. Исследовательское издание (nwtsty) содержит учебные примечания и больше сносок; на мобильных устройствах с ограниченной памятью более компактный выбор — обычное издание (nwt), которое занимает намного меньше места. Файл хранится локально в папке плагина и не копируется в хранилище.',
		btnChooseFile: 'Выбрать файл…',
		btnReplaceFile: 'Заменить файл…',
		btnRemoveBible: 'Удалить файл Библии',
		headScriptureSuggest: 'Подсказки при вводе библейского текста',
		headScriptureSuggestDesc: 'Какие действия предлагаются при вводе библейской ссылки (например, «Псалом 12:1») и в каком порядке. Отключённые действия не отображаются.',
		btnMoveUp: 'Переместить вверх',
		btnMoveDown: 'Переместить вниз',

		importTitle: 'Импорт программы конгресса',
		importCommand: 'Импортировать программу конгресса',
		importFileName: 'Файл программы',
		importFileDesc: 'Выберите файл .jwpub или ZIP-архив с RTF.',
		btnPickFile: 'Выбрать файл…',
		importTarget: 'Целевая папка',
		importTargetDesc: 'По умолчанию: корень хранилища — конгресс создаётся сразу как отдельная папка, без папки-обёртки. Можно также выбрать существующую папку или создать новую.',
		optVaultRoot: 'Корень хранилища (без вложенной папки)',
		optNewFolder: '➕ Новая папка…',
		importNewFolder: 'Название новой папки',
		importNewFolderPlaceholder: 'например, Конгрессы',
		btnImport: 'Импортировать',
		btnCancel: 'Отмена',
		previewHeading: 'Предпросмотр',
		previewFailed: err => `Предпросмотр невозможен: ${err}`,
		rowType: 'Тип',
		rowTheme: 'Тема',
		rowYear: 'Год',
		rowDays: 'Дни',
		rowSource: 'Источник',
		rowSourceRtf: 'RTF (резервный вариант)',
		rowItems: 'Пункты программы',
		rowLanguage: 'Язык',
		langDisplay: lang => LANG_DISPLAY_NAMES[lang].ru,
		typeLabels: {
			'CO': 'Конгресс',
			'CA-copgm': 'Районный конгресс (с районным старейшиной)',
			'CA-brpgm': 'Районный конгресс (с представителем филиала)',
		},

		updateCommand: 'Обновить заметки конгресса',
		updateTitle: 'Обновление заметок конгресса',
		updateExplanation: 'Выберите тот же файл программы ещё раз, чтобы сверить его с уже импортированной папкой конгресса — это полезно, например, после того как обновление плагина исправляет ошибку в заметках (день, время или библейские тексты). Всё, что вы уже вписали (имя докладчика, личные заметки), остаётся нетронутым; обновляются только автоматически создаваемые поля.',
		updateTargetFolder: 'Папка конгресса для обновления',
		updateTargetFolderDesc: 'Папка, созданная при первоначальном импорте.',
		updateNoFoldersFound: 'В хранилище не найдено ни одной папки.',
		btnUpdate: 'Обновить',
		noticeUpdateFolderNotFound: path => `Папка «${path}» не найдена.`,
		noticeUpdateResult: (merged, created, needsReimport, unchanged) => {
			const parts = [`обновлено: ${merged}`];
			if (created > 0) parts.push(`создано заново: ${created}`);
			if (unchanged > 0) parts.push(`уже актуально: ${unchanged}`);
			if (needsReimport > 0) parts.push(`требуют полного повторного импорта (устаревший формат): ${needsReimport}`);
			return `Обновление завершено: ${parts.join(', ')}.`;
		},

		legacyModalTitle: 'Возможные исправления для старых заметок',
		legacyModalDesc: 'Эти заметки были созданы в версии плагина до 1.9.0 и не содержат невидимых маркеров — поэтому здесь предлагаются только строки, которые можно однозначно сопоставить с известным полем. При нажатии «Применить» изменяются только заметки с включённым переключателем; всё остальное в каждой заметке остаётся без изменений.',
		noticeLegacyCorrectionsFound: count => `Найдено старых заметок с возможными исправлениями: ${count}. (Нажмите, чтобы проверить)`,
		noticeLegacyApplied: count => `Обновлено заметок: ${count}.`,
		btnApply: 'Применить',
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

		popupLoading: 'Cargando el texto bíblico…',
		popupMissing: 'No hay texto disponible para este versículo (este pasaje no está indexado en el archivo de la Biblia cargado).',
		popupLoadFailed: 'No se pudo cargar el archivo de la Biblia. El botón de abajo abre el pasaje en JW Library en su lugar.',
		popupOpenJwLibrary: 'Abrir en JW Library',
		popupFootnotes: 'Notas',
		popupCrossRefs: 'Referencias',
		popupStudyNotes: 'Notas de estudio',
		popupVersePrefix: 'Versículo',
		popupNoText: '(texto no disponible)',
		popupBack: 'Volver al pasaje anterior',
		popupVerseBefore: '◀ Versículo anterior',
		popupVerseAfter: 'Versículo siguiente ▶',
		popupWholeChapter: 'Capítulo completo',
		btnInsertAsQuote: 'Insertar como cita',
		noticeVerseInserted: 'Versículo insertado como cita.',
		noticeNoActiveNote: 'No hay ninguna nota activa en la que insertar. Abra primero una nota.',
		scriptureSuggestLink: 'Enlazar',
		scriptureSuggestLinkAndOpen: 'Enlazar y abrir JW Library',
		scriptureSuggestQuoteKeepLink: 'Insertar como cita y mantener el enlace',

		noticeUpdated: version => `JW Convention Program se actualizó a la versión ${version}.\n\nLas mejoras en las plantillas de notas no llegan automáticamente a los congresos ya importados: ejecute "Actualizar notas del congreso" (paleta de comandos) con el mismo archivo de programa para aplicarlas — todo lo que ya haya escrito (orador, notas) se conserva. Solo las notas de una versión muy antigua del plugin no se pueden actualizar así; para esas, elimine la carpeta del congreso y vuelva a importar.\n\n(Haga clic para cerrar)`,
		noticeBibleSaved: 'Archivo de la Biblia guardado.',
		noticeBibleMissingOnDevice: 'El archivo de la Biblia no está presente en este dispositivo (la configuración se sincroniza entre dispositivos, pero el archivo en sí no). Vuelva a seleccionarlo en "Archivo de la Biblia" en la configuración del plugin.',
		noticeBibleLoadFailed: err => `No se pudo cargar el archivo de la Biblia: ${err}`,
		noticeQuoteNeedsBibleFile: 'No hay ningún archivo de la Biblia cargado; en su lugar, se enlazó el texto bíblico. Agregue un archivo de la Biblia en la configuración del plugin para insertar citas directamente.',
		noticeBibleHint: 'Consejo: Agregue un archivo jwpub de la Biblia (por ejemplo, la edición de estudio de jw.org) en la configuración del plugin — al hacer clic en un texto bíblico se abrirá entonces el versículo con referencias y notas de estudio directamente en una ventana emergente en Obsidian. (Haga clic para abrir la configuración)',
		noticeImportFailed: err => `Error al importar: ${err}`,
		noticeRtfFallback: 'Error al procesar el archivo jwpub; se usó el método alternativo RTF.',
		noticeImportProgress: (done, total) => `Importando… ${done}/${total}`,
		noticeImportResult: (folder, created, updated, skipped) => {
			const parts = [`${created} nuevas`];
			if (updated > 0) parts.push(`${updated} actualizadas`);
			if (skipped > 0) parts.push(`${skipped} omitidas (ya existían)`);
			return `"${folder}": ${parts.join(', ')}.`;
		},
		noticeImportRolledBack: err => `Error al importar; se revirtieron los archivos creados hasta el momento: ${err}`,
		noticePickFileFirst: 'Seleccione primero un archivo.',
		noticeOpenOverviewHint: '(Haga clic para abrir el resumen)',
		noticeNotAFolder: path => `"${path}" no es una carpeta.`,

		headImport: 'Importar y actualizar programas de congreso',
		headImportDesc: 'Hay dos formas de incorporar un programa de congreso: "Importar programa de congreso" crea una nueva carpeta de congreso — volver a importar en la misma carpeta solo actualiza los archivos generados automáticamente (resumen, imagen de portada); las notas con anotaciones propias no se modifican. "Actualizar notas del congreso", en cambio, concilia campo por campo (día, hora, textos bíblicos, encabezados) una carpeta ya importada — incluso dentro de notas ya editadas a mano, sin perder nada de lo escrito allí. Útil, por ejemplo, después de que una actualización del plugin corrige un error en las notas. Para notas de una versión muy antigua del plugin (sin marcadores invisibles), "Actualizar notas del congreso" ofrece en su lugar una ventana de revisión con correcciones propuestas, que se pueden confirmar individualmente.',
		setImportActionDesc: 'Seleccione un archivo de programa y cree notas a partir de él (véase la explicación anterior).',
		btnOpen: 'Abrir',
		headGeneral: 'General',
		setTargetFolder: 'Carpeta de destino',
		setTargetFolderDesc: 'Carpeta principal en la que se crean las carpetas de congreso. Déjela vacía para que cada congreso se convierta en su propia carpeta de nivel superior en la raíz del vault (sin carpeta contenedora adicional).',
		setTargetFolderPlaceholder: '(raíz del vault)',
		setLang: 'Idioma de la interfaz y de la ventana emergente de versículos bíblicos',
		setLangDesc: 'Las etiquetas del plugin y los nombres de los libros bíblicos en la ventana emergente. Las notas siguen automáticamente el idioma del archivo de programa importado.',
		headScripture: 'Textos bíblicos',
		setScriptureLinks: 'Enlazar textos bíblicos',
		setScriptureLinksDesc: 'Genera enlaces a JW Library en los que se puede hacer clic para cada texto bíblico.',
		setBiblePopupEnabled: 'Activar la ventana emergente de versículos bíblicos',
		setBiblePopupEnabledDesc: 'Abre el texto del versículo directamente en Obsidian al hacer clic o tocar un texto bíblico, en lugar de abrir solo JW Library. Se puede desactivar independientemente del archivo de la Biblia cargado.',
		setReviewNote: 'Crear nota de repaso',
		setReviewNoteDesc: 'Crea además una nota "Repaso" con las tres preguntas de reflexión estándar (en las asambleas de circuito se enlaza a las preguntas de repaso impresas; en los congresos regionales se menciona el video con los aspectos más destacados).',
		headNoteFields: 'Campos de la nota',
		setShowDay: 'Mostrar el campo "Día"',
		setShowDayDesc: 'Solo relevante para los congresos regionales (las asambleas de circuito duran un solo día).',
		setShowTime: 'Mostrar el campo "Hora"',
		setShowScriptures: 'Mostrar el campo "Textos bíblicos"',
		setShowSpeaker: 'Mostrar el campo "Orador"',
		setExtraFields: 'Campos adicionales',
		setExtraFieldsDesc: 'Cada línea se agrega a cada nota de punto del programa como un campo propio con su propio espacio para escribir (por ejemplo, "**Notas:**").',
		setFrontmatter: 'Agregar frontmatter (propiedades)',
		setFrontmatterDesc: 'Agrega frontmatter YAML con claves estables en inglés (convention, type, day, time) a cada nota generada, por ejemplo, para consultas de Dataview. Las claves son intencionalmente independientes del idioma.',
		setBibleFile: 'Archivo de la Biblia',
		bibleDescLoaded: 'El archivo de la Biblia está cargado. Al hacer clic en un texto bíblico se muestra el versículo directamente en Obsidian (con un botón para abrirlo en JW Library).',
		bibleDescMissing: 'Opcional: seleccione un archivo jwpub de la Biblia (por ejemplo, descargado de jw.org) para que, al hacer clic en un texto bíblico, se muestre el versículo directamente en Obsidian en lugar de abrir solo JW Library. La edición de estudio (nwtsty) ofrece notas de estudio y más notas; en dispositivos móviles con memoria limitada, la edición normal (nwt), mucho más pequeña, es la opción que ahorra memoria. El archivo se guarda localmente en la carpeta del plugin, no se copia al vault.',
		btnChooseFile: 'Elegir archivo…',
		btnReplaceFile: 'Reemplazar archivo…',
		btnRemoveBible: 'Quitar archivo de la Biblia',
		headScriptureSuggest: 'Sugerencias al escribir un texto bíblico',
		headScriptureSuggestDesc: 'Qué acciones se sugieren al escribir una referencia bíblica (por ejemplo, "Salmo 12:1") y en qué orden. Las acciones desactivadas no se muestran.',
		btnMoveUp: 'Subir',
		btnMoveDown: 'Bajar',

		importTitle: 'Importar programa de congreso',
		importCommand: 'Importar programa de congreso',
		importFileName: 'Archivo de programa',
		importFileDesc: 'Seleccione un archivo .jwpub o un ZIP con RTF.',
		btnPickFile: 'Elegir archivo…',
		importTarget: 'Carpeta de destino',
		importTargetDesc: 'Predeterminado: raíz del vault; el congreso se crea directamente como su propia carpeta, sin carpeta contenedora. También puede elegir una carpeta existente o crear una nueva.',
		optVaultRoot: 'Raíz del vault (sin subcarpeta)',
		optNewFolder: '➕ Nueva carpeta…',
		importNewFolder: 'Nombre de la nueva carpeta',
		importNewFolderPlaceholder: 'p. ej. Congresos',
		btnImport: 'Importar',
		btnCancel: 'Cancelar',
		previewHeading: 'Vista previa',
		previewFailed: err => `No se pudo generar la vista previa: ${err}`,
		rowType: 'Tipo',
		rowTheme: 'Tema',
		rowYear: 'Año',
		rowDays: 'Días',
		rowSource: 'Fuente',
		rowSourceRtf: 'RTF (alternativo)',
		rowItems: 'Puntos del programa',
		rowLanguage: 'Idioma',
		langDisplay: lang => LANG_DISPLAY_NAMES[lang].es,
		typeLabels: {
			'CO': 'Asamblea regional',
			'CA-copgm': 'Asamblea de circuito (con el superintendente de circuito)',
			'CA-brpgm': 'Asamblea de circuito (con representante de la sucursal)',
		},

		updateCommand: 'Actualizar notas del congreso',
		updateTitle: 'Actualizar notas del congreso',
		updateExplanation: 'Vuelva a seleccionar el mismo archivo de programa y concílielo con una carpeta de congreso ya importada — útil después de que una actualización del plugin corrija un error en las notas (por ejemplo, día, hora o textos bíblicos). Todo lo que ya haya escrito (nombre del orador, notas personales) se deja intacto; solo se actualizan los campos generados automáticamente.',
		updateTargetFolder: 'Carpeta de congreso a actualizar',
		updateTargetFolderDesc: 'La carpeta creada por la importación original.',
		updateNoFoldersFound: 'No se encontraron carpetas en el vault.',
		btnUpdate: 'Actualizar',
		noticeUpdateFolderNotFound: path => `No se encontró la carpeta "${path}".`,
		noticeUpdateResult: (merged, created, needsReimport, unchanged) => {
			const parts = [`${merged} actualizadas`];
			if (created > 0) parts.push(`${created} nuevas`);
			if (unchanged > 0) parts.push(`${unchanged} sin cambios`);
			if (needsReimport > 0) parts.push(`${needsReimport} requieren una reimportación completa (formato antiguo)`);
			return `Actualización completa: ${parts.join(', ')}.`;
		},

		legacyModalTitle: 'Posibles correcciones para notas antiguas',
		legacyModalDesc: 'Estas notas se crearon con una versión del plugin anterior a la 1.9.0 y no tienen marcadores invisibles — por eso aquí solo se proponen líneas que se puedan asociar sin ambigüedad a un campo conocido. Solo se modifican las notas con el interruptor activado al hacer clic en "Aplicar"; el resto de cada nota permanece intacto.',
		noticeLegacyCorrectionsFound: count => `Se encontraron ${count} nota(s) antigua(s) con posibles correcciones. (Haga clic para revisar)`,
		noticeLegacyApplied: count => `${count} nota(s) actualizada(s).`,
		btnApply: 'Aplicar',
	},
};

/**
 * Note-generation strings for every language the parser can detect
 * (`CongressLang`), as a plain alias of `L` — every language now has a full
 * `Strings` object (a superset of `NoteStrings`), so `NL` no longer needs its
 * own separate translations. Kept as a distinct export so code that only
 * builds notes (NoteBuilder, JwpubParser) can depend on the narrower
 * `NoteStrings` type without pulling in popup/settings strings it never uses.
 */
export const NL: Record<CongressLang, NoteStrings> = L;
