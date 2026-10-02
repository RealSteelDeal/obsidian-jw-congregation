// Every language the plugin understands, for both roles: the UI/popup
// language (settings.lang) and a note's own language (Congress.lang, which
// follows whatever the imported programme file was written in). The two
// roles are independent of each other — a French UI can still import a
// German programme file — but since every language is supported for both,
// the two type names are now the same set; kept separate for readability at
// call sites (SupportedLang = "the user's chosen interface language",
// CongressLang = "this note's language").
export type SupportedLang = 'de' | 'en' | 'fr' | 'it' | 'pt' | 'ru' | 'es' | 'ko';
export type CongressLang = SupportedLang;

interface BookEntry {
	de: string;
	en: string;
	fr: string;
	it: string;
	pt: string;
	ru: string;
	es: string;
	ko: string;
}

// Index 0 = book 1 (Genesis) … index 65 = book 66 (Revelation). de/en were
// hand-translated; fr/it/pt/ru/es are read verbatim from each language's own
// nwtsty jwpub Bible file (BibleBook.BookDocumentId → Document.Title) — the
// project convention of reading real data over guessing/hand-translating.
//
// That difference showed: on 21.09.2026 every name was checked against its
// own Bible file's titles, and the only mismatches anywhere were three of the
// hand-translated GERMAN ones — "Zefanja" (the file writes Zephanja, and the
// programmes abbreviate it "Zeph."), "Ester" (Esther) and "Hoheslied" (the
// file's title reads "Das Hohe Lied"). The five languages read from their
// files had none. Found because a user typed "Zephan" and the completion
// stayed silent.
//
// Caveat for the third: the title columns hold FORMAL titles, not citation
// forms ("Das erste Buch Mose", not "1. Mose"), so "Hohes Lied" is derived
// from a title rather than seen in a citation — the weakest of the three, and
// still unconfirmed against a real citation.
//
// ko is read from nwt_KO.jwpub's BibleBook.BookDisplayTitle
// (scripts/dump-book-names.mjs, 02.10.2026). That column holds the formal
// title in German but the short form in Korean, so it could not be trusted
// on the strength of the other languages; the citation form, spacing
// included ("디모데 전서", not "디모데전서"), was confirmed by a native
// speaker in issue #1. The names carry none of the U+200B the Korean
// programme files scatter through their text.
const BOOK_NAMES: BookEntry[] = [
	{ de: '1. Mose', en: 'Genesis', fr: 'Genèse', it: 'Genesi', pt: 'Génesis', ru: 'Бытие', es: 'Génesis', ko: '창세기' },
	{ de: '2. Mose', en: 'Exodus', fr: 'Exode', it: 'Esodo', pt: 'Êxodo', ru: 'Исход', es: 'Éxodo', ko: '출애굽기' },
	{ de: '3. Mose', en: 'Leviticus', fr: 'Lévitique', it: 'Levitico', pt: 'Levítico', ru: 'Левит', es: 'Levítico', ko: '레위기' },
	{ de: '4. Mose', en: 'Numbers', fr: 'Nombres', it: 'Numeri', pt: 'Números', ru: 'Числа', es: 'Números', ko: '민수기' },
	{ de: '5. Mose', en: 'Deuteronomy', fr: 'Deutéronome', it: 'Deuteronomio', pt: 'Deuteronómio', ru: 'Второзаконие', es: 'Deuteronomio', ko: '신명기' },
	{ de: 'Josua', en: 'Joshua', fr: 'Josué', it: 'Giosuè', pt: 'Josué', ru: 'Иисус Навин', es: 'Josué', ko: '여호수아' },
	{ de: 'Richter', en: 'Judges', fr: 'Juges', it: 'Giudici', pt: 'Juízes', ru: 'Судей', es: 'Jueces', ko: '사사기' },
	{ de: 'Rut', en: 'Ruth', fr: 'Ruth', it: 'Rut', pt: 'Rute', ru: 'Руфь', es: 'Rut', ko: '룻기' },
	{ de: '1. Samuel', en: '1 Samuel', fr: '1 Samuel', it: '1 Samuele', pt: '1 Samuel', ru: '1 Самуила', es: '1 Samuel', ko: '사무엘상' },
	{ de: '2. Samuel', en: '2 Samuel', fr: '2 Samuel', it: '2 Samuele', pt: '2 Samuel', ru: '2 Самуила', es: '2 Samuel', ko: '사무엘하' },
	{ de: '1. Könige', en: '1 Kings', fr: '1 Rois', it: '1 Re', pt: '1 Reis', ru: '1 Царей', es: '1 Reyes', ko: '열왕기상' },
	{ de: '2. Könige', en: '2 Kings', fr: '2 Rois', it: '2 Re', pt: '2 Reis', ru: '2 Царей', es: '2 Reyes', ko: '열왕기하' },
	{ de: '1. Chronika', en: '1 Chronicles', fr: '1 Chroniques', it: '1 Cronache', pt: '1 Crónicas', ru: '1 Летопись', es: '1 Crónicas', ko: '역대기상' },
	{ de: '2. Chronika', en: '2 Chronicles', fr: '2 Chroniques', it: '2 Cronache', pt: '2 Crónicas', ru: '2 Летопись', es: '2 Crónicas', ko: '역대기하' },
	{ de: 'Esra', en: 'Ezra', fr: 'Esdras', it: 'Esdra', pt: 'Esdras', ru: 'Ездра', es: 'Esdras', ko: '에스라' },
	{ de: 'Nehemia', en: 'Nehemiah', fr: 'Néhémie', it: 'Neemia', pt: 'Neemias', ru: 'Неемия', es: 'Nehemías', ko: '느헤미야' },
	{ de: 'Esther', en: 'Esther', fr: 'Esther', it: 'Ester', pt: 'Ester', ru: 'Эсфирь', es: 'Ester', ko: '에스더' },
	{ de: 'Hiob', en: 'Job', fr: 'Job', it: 'Giobbe', pt: 'Jó', ru: 'Иов', es: 'Job', ko: '욥기' },
	{ de: 'Psalm', en: 'Psalm', fr: 'Psaumes', it: 'Salmi', pt: 'Salmos', ru: 'Псалмы', es: 'Salmos', ko: '시편' },
	{ de: 'Sprüche', en: 'Proverbs', fr: 'Proverbes', it: 'Proverbi', pt: 'Provérbios', ru: 'Притчи', es: 'Proverbios', ko: '잠언' },
	{ de: 'Prediger', en: 'Ecclesiastes', fr: 'Ecclésiaste', it: 'Ecclesiaste', pt: 'Eclesiastes', ru: 'Экклезиаст', es: 'Eclesiastés', ko: '전도서' },
	{ de: 'Hohes Lied', en: 'Song of Solomon', fr: 'Chant de Salomon', it: 'Cantico dei Cantici', pt: 'Cântico de Salomão', ru: 'Песня Соломона', es: 'El Cantar de los Cantares', ko: '솔로몬의 노래' },
	{ de: 'Jesaja', en: 'Isaiah', fr: 'Isaïe', it: 'Isaia', pt: 'Isaías', ru: 'Исайя', es: 'Isaías', ko: '이사야' },
	{ de: 'Jeremia', en: 'Jeremiah', fr: 'Jérémie', it: 'Geremia', pt: 'Jeremias', ru: 'Иеремия', es: 'Jeremías', ko: '예레미야' },
	{ de: 'Klagelieder', en: 'Lamentations', fr: 'Lamentations', it: 'Lamentazioni', pt: 'Lamentações', ru: 'Плач Иеремии', es: 'Lamentaciones', ko: '예레미야 애가' },
	{ de: 'Hesekiel', en: 'Ezekiel', fr: 'Ézéchiel', it: 'Ezechiele', pt: 'Ezequiel', ru: 'Иезекииль', es: 'Ezequiel', ko: '에스겔' },
	{ de: 'Daniel', en: 'Daniel', fr: 'Daniel', it: 'Daniele', pt: 'Daniel', ru: 'Даниил', es: 'Daniel', ko: '다니엘' },
	{ de: 'Hosea', en: 'Hosea', fr: 'Osée', it: 'Osea', pt: 'Oseias', ru: 'Осия', es: 'Oseas', ko: '호세아' },
	{ de: 'Joel', en: 'Joel', fr: 'Joël', it: 'Gioele', pt: 'Joel', ru: 'Иоиль', es: 'Joel', ko: '요엘' },
	{ de: 'Amos', en: 'Amos', fr: 'Amos', it: 'Amos', pt: 'Amós', ru: 'Амос', es: 'Amós', ko: '아모스' },
	{ de: 'Obadja', en: 'Obadiah', fr: 'Abdias', it: 'Abdia', pt: 'Obadias', ru: 'Авдий', es: 'Abdías', ko: '오바댜' },
	{ de: 'Jona', en: 'Jonah', fr: 'Jonas', it: 'Giona', pt: 'Jonas', ru: 'Иона', es: 'Jonás', ko: '요나' },
	{ de: 'Micha', en: 'Micah', fr: 'Michée', it: 'Michea', pt: 'Miqueias', ru: 'Михей', es: 'Miqueas', ko: '미가' },
	{ de: 'Nahum', en: 'Nahum', fr: 'Nahum', it: 'Naum', pt: 'Naum', ru: 'Наум', es: 'Nahúm', ko: '나훔' },
	{ de: 'Habakuk', en: 'Habakkuk', fr: 'Habacuc', it: 'Abacuc', pt: 'Habacuque', ru: 'Аввакум', es: 'Habacuc', ko: '하박국' },
	{ de: 'Zephanja', en: 'Zephaniah', fr: 'Sophonie', it: 'Sofonia', pt: 'Sofonias', ru: 'Софония', es: 'Sofonías', ko: '스바냐' },
	{ de: 'Haggai', en: 'Haggai', fr: 'Aggée', it: 'Aggeo', pt: 'Ageu', ru: 'Аггей', es: 'Ageo', ko: '학개' },
	{ de: 'Sacharja', en: 'Zechariah', fr: 'Zacharie', it: 'Zaccaria', pt: 'Zacarias', ru: 'Захария', es: 'Zacarías', ko: '스가랴' },
	{ de: 'Maleachi', en: 'Malachi', fr: 'Malachie', it: 'Malachia', pt: 'Malaquias', ru: 'Малахия', es: 'Malaquías', ko: '말라기' },
	{ de: 'Matthäus', en: 'Matthew', fr: 'Matthieu', it: 'Matteo', pt: 'Mateus', ru: 'Матфея', es: 'Mateo', ko: '마태복음' },
	{ de: 'Markus', en: 'Mark', fr: 'Marc', it: 'Marco', pt: 'Marcos', ru: 'Марка', es: 'Marcos', ko: '마가복음' },
	{ de: 'Lukas', en: 'Luke', fr: 'Luc', it: 'Luca', pt: 'Lucas', ru: 'Луки', es: 'Lucas', ko: '누가복음' },
	{ de: 'Johannes', en: 'John', fr: 'Jean', it: 'Giovanni', pt: 'João', ru: 'Иоанна', es: 'Juan', ko: '요한복음' },
	{ de: 'Apostelgeschichte', en: 'Acts', fr: 'Actes', it: 'Atti', pt: 'Atos', ru: 'Деяния', es: 'Hechos', ko: '사도행전' },
	{ de: 'Römer', en: 'Romans', fr: 'Romains', it: 'Romani', pt: 'Romanos', ru: 'Римлянам', es: 'Romanos', ko: '로마서' },
	{ de: '1. Korinther', en: '1 Corinthians', fr: '1 Corinthiens', it: '1 Corinti', pt: '1 Coríntios', ru: '1 Коринфянам', es: '1 Corintios', ko: '고린도 전서' },
	{ de: '2. Korinther', en: '2 Corinthians', fr: '2 Corinthiens', it: '2 Corinti', pt: '2 Coríntios', ru: '2 Коринфянам', es: '2 Corintios', ko: '고린도 후서' },
	{ de: 'Galater', en: 'Galatians', fr: 'Galates', it: 'Galati', pt: 'Gálatas', ru: 'Галатам', es: 'Gálatas', ko: '갈라디아서' },
	{ de: 'Epheser', en: 'Ephesians', fr: 'Éphésiens', it: 'Efesini', pt: 'Efésios', ru: 'Эфесянам', es: 'Efesios', ko: '에베소서' },
	{ de: 'Philipper', en: 'Philippians', fr: 'Philippiens', it: 'Filippesi', pt: 'Filipenses', ru: 'Филиппийцам', es: 'Filipenses', ko: '빌립보서' },
	{ de: 'Kolosser', en: 'Colossians', fr: 'Colossiens', it: 'Colossesi', pt: 'Colossenses', ru: 'Колоссянам', es: 'Colosenses', ko: '골로새서' },
	{ de: '1. Thessalonicher', en: '1 Thessalonians', fr: '1 Thessaloniciens', it: '1 Tessalonicesi', pt: '1 Tessalonicenses', ru: '1 Фессалоникийцам', es: '1 Tesalonicenses', ko: '데살로니가 전서' },
	{ de: '2. Thessalonicher', en: '2 Thessalonians', fr: '2 Thessaloniciens', it: '2 Tessalonicesi', pt: '2 Tessalonicenses', ru: '2 Фессалоникийцам', es: '2 Tesalonicenses', ko: '데살로니가 후서' },
	{ de: '1. Timotheus', en: '1 Timothy', fr: '1 Timothée', it: '1 Timoteo', pt: '1 Timóteo', ru: '1 Тимофею', es: '1 Timoteo', ko: '디모데 전서' },
	{ de: '2. Timotheus', en: '2 Timothy', fr: '2 Timothée', it: '2 Timoteo', pt: '2 Timóteo', ru: '2 Тимофею', es: '2 Timoteo', ko: '디모데 후서' },
	{ de: 'Titus', en: 'Titus', fr: 'Tite', it: 'Tito', pt: 'Tito', ru: 'Титу', es: 'Tito', ko: '디도서' },
	{ de: 'Philemon', en: 'Philemon', fr: 'Philémon', it: 'Filemone', pt: 'Filémon', ru: 'Филимону', es: 'Filemón', ko: '빌레몬서' },
	{ de: 'Hebräer', en: 'Hebrews', fr: 'Hébreux', it: 'Ebrei', pt: 'Hebreus', ru: 'Евреям', es: 'Hebreos', ko: '히브리서' },
	{ de: 'Jakobus', en: 'James', fr: 'Jacques', it: 'Giacomo', pt: 'Tiago', ru: 'Иакова', es: 'Santiago', ko: '야고보서' },
	{ de: '1. Petrus', en: '1 Peter', fr: '1 Pierre', it: '1 Pietro', pt: '1 Pedro', ru: '1 Петра', es: '1 Pedro', ko: '베드로 전서' },
	{ de: '2. Petrus', en: '2 Peter', fr: '2 Pierre', it: '2 Pietro', pt: '2 Pedro', ru: '2 Петра', es: '2 Pedro', ko: '베드로 후서' },
	{ de: '1. Johannes', en: '1 John', fr: '1 Jean', it: '1 Giovanni', pt: '1 João', ru: '1 Иоанна', es: '1 Juan', ko: '요한 1서' },
	{ de: '2. Johannes', en: '2 John', fr: '2 Jean', it: '2 Giovanni', pt: '2 João', ru: '2 Иоанна', es: '2 Juan', ko: '요한 2서' },
	{ de: '3. Johannes', en: '3 John', fr: '3 Jean', it: '3 Giovanni', pt: '3 João', ru: '3 Иоанна', es: '3 Juan', ko: '요한 3서' },
	{ de: 'Judas', en: 'Jude', fr: 'Jude', it: 'Giuda', pt: 'Judas', ru: 'Иуды', es: 'Judas', ko: '유다서' },
	{ de: 'Offenbarung', en: 'Revelation', fr: 'Révélation', it: 'Rivelazione', pt: 'Apocalipse', ru: 'Откровение', es: 'Apocalipsis', ko: '요한 계시록' },
];

export function getBookName(bookNumber: number, lang: CongressLang): string {
	const entry = BOOK_NAMES[bookNumber - 1];
	if (!entry) throw new Error(`Invalid book number: ${bookNumber}`);
	return entry[lang];
}

function normalizeBookKey(s: string): string {
	return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// Built lazily (once per language, on first lookup) and cached — reused on
// every keystroke by ScriptureTextParser, so this must stay a plain Map
// lookup, not a linear scan of BOOK_NAMES.
const BOOK_NUMBER_LOOKUP = new Map<SupportedLang, Map<string, number>>();

function getLookupMap(lang: SupportedLang): Map<string, number> {
	let map = BOOK_NUMBER_LOOKUP.get(lang);
	if (!map) {
		map = new Map();
		BOOK_NAMES.forEach((entry, i) => map!.set(normalizeBookKey(entry[lang]), i + 1));
		BOOK_NUMBER_LOOKUP.set(lang, map);
	}
	return map;
}

// Below this length, a prefix is too likely to collide across unrelated
// books (or just plain text) to trust — "Ps" (2) still uniquely resolves to
// Psalm, but 1 character would match almost anything.
const MIN_ABBREVIATION_LENGTH = 2;

/**
 * Abbreviations the prefix rule below cannot reach. Every entry was READ off a
 * real publication, never assumed: a scripture link's visible text paired with
 * the book number in its own `jwpub://b/NWTR/` href, harvested by
 * `scripts/dump-book-abbreviations.mjs` from the user's own programme and
 * meeting-workbook files. Three kinds turn up, all of them unreachable by
 * truncation:
 *
 *   - **skips letters** rather than truncating — "Apg." (Apostelgeschichte),
 *     "Offb." (Offenbarung), "Klg" (Klagelieder), "Jas." (James);
 *   - **truncates ambiguously**, so the prefix rule refuses it — "Phil."
 *     prefixes both Philipper and Philemon, and publications nonetheless use
 *     it for Philipper. Reported as a real annoyance on 21.09.2026: the book
 *     had to be written out in full.
 *
 * Keys are normalised the same way lookups are (see normalizeBookKey), so
 * dots and capitalisation in the written form do not matter — which is why
 * "Apg" and "Apg." are one entry, not two.
 *
 * Deliberately not exhaustive. It holds what real files prove and nothing
 * else: Philemon's own "Phlm." is missing because none of the files checked
 * cites Philemon at all, and inventing it is exactly what this table exists
 * to avoid. Typing "Philem." still resolves by prefix.
 */
const BOOK_ABBREVIATIONS: Partial<Record<SupportedLang, Record<string, number>>> = {
	// "zeph" was here until 21.09.2026, for a "Zeph." that did not fit the
	// "Zefanja" this file used to write. The name itself turned out to be
	// wrong (see BOOK_NAMES); with "Zephanja" the prefix rule reaches it and
	// the entry became redundant.
	de: { klg: 25, apg: 44, phil: 50, offb: 66 },
	en: { jas: 59 },
	it: { salmo: 19 },
	ru: { псалом: 19 },
	// The Korean programmes cite Psalms as "시" (6× across the three of them,
	// never for another book). It IS a prefix of 시편 — but one character, so
	// MIN_ABBREVIATION_LENGTH turns it away. Entered here rather than lowering
	// that rule for Hangul, which would accept every single syllable that
	// happens to begin one book. Harvested 02.10.2026.
	ko: { 시: 19 },
};

/**
 * Reverse lookup: a book name typed as plain text (any casing/punctuation,
 * e.g. "psalm", "1. Mose", "1 mose") → canonical book number — used to
 * recognize a scripture reference typed as plain text (see
 * ScriptureTextParser). Limited to `SupportedLang` (the settings/popup
 * language), matching the scope of that feature.
 *
 * Resolved in three steps, most certain first: the exact name, then the
 * abbreviations real publications actually print (BOOK_ABBREVIATIONS), then
 * prefix matching.
 *
 * Prefix matching alone covers most real citation abbreviations, since they
 * are usually a literal truncation of the full name ("Matth." → "Matthäus",
 * "Ps" → "Psalm", "1 Mo" → "1. Mose"). A prefix is only accepted when it
 * resolves to exactly ONE book; an ambiguous one (e.g. "Jo", which prefixes
 * "Johannes", "Joel" and "Jona") is rejected rather than guessed at. What it
 * cannot do is reach an abbreviation that skips letters ("Apg."), spells the
 * name differently ("Zeph.") or is ambiguous even though publications use it
 * unambiguously ("Phil." for Philipper) — hence the table, which is consulted
 * first and is itself read from real files rather than written from memory.
 */
export function lookupBookNumber(rawName: string, lang: SupportedLang): number | undefined {
	const map = getLookupMap(lang);
	const key = normalizeBookKey(rawName);

	const exact = map.get(key);
	if (exact !== undefined) return exact;

	const abbreviation = BOOK_ABBREVIATIONS[lang]?.[key];
	if (abbreviation !== undefined) return abbreviation;

	if (key.length < MIN_ABBREVIATION_LENGTH) return undefined;

	let match: number | undefined;
	for (const [fullKey, bookNumber] of map) {
		if (!fullKey.startsWith(key)) continue;
		if (match !== undefined) return undefined; // ambiguous prefix — reject
		match = bookNumber;
	}
	return match;
}

/**
 * Every book whose name starts with `rawPrefix`, in canonical order — the
 * completions offered while a book name is being typed (see
 * BookNameEditorSuggest). Unlike lookupBookNumber(), several matches are a
 * normal result here rather than a reason to give up: the point is to let the
 * user pick.
 *
 * Compared on the same normalised key as the lookup, so "1. kor", "1 Kor" and
 * "1.Kor" all reach "1. Korinther".
 *
 * A prefix that is ALREADY a complete book name yields nothing: there is
 * nothing left to complete, and offering back the word just finished would be
 * pure noise — measured against real notes, that case alone accounted for 47
 * of 55 triggers.
 */
export function findBooksByPrefix(rawPrefix: string, lang: SupportedLang): { book: number; name: string }[] {
	const key = normalizeBookKey(rawPrefix);
	if (!key) return [];
	const map = getLookupMap(lang);
	if (map.has(key)) return [];

	const found: { book: number; name: string }[] = [];
	for (const [fullKey, book] of map) {
		if (fullKey.startsWith(key)) found.push({ book, name: getBookName(book, lang) });
	}
	return found.sort((a, b) => a.book - b.book);
}
