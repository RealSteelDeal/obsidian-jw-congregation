// Every language the plugin understands, for both roles: the UI/popup
// language (settings.lang) and a note's own language (Congress.lang, which
// follows whatever the imported programme file was written in). The two
// roles are independent of each other — a French UI can still import a
// German programme file — but since every language is supported for both,
// the two type names are now the same set; kept separate for readability at
// call sites (SupportedLang = "the user's chosen interface language",
// CongressLang = "this note's language").
export type SupportedLang = 'de' | 'en' | 'fr' | 'it' | 'pt' | 'ru' | 'es';
export type CongressLang = SupportedLang;

interface BookEntry {
	de: string;
	en: string;
	fr: string;
	it: string;
	pt: string;
	ru: string;
	es: string;
}

// Index 0 = book 1 (Genesis) … index 65 = book 66 (Revelation). de/en are
// hand-translated; fr/it/pt/ru/es are read verbatim from each language's own
// nwtsty jwpub Bible file (BibleBook.BookDocumentId → Document.Title) — the
// project convention of reading real data over guessing/hand-translating.
const BOOK_NAMES: BookEntry[] = [
	{ de: '1. Mose', en: 'Genesis', fr: 'Genèse', it: 'Genesi', pt: 'Génesis', ru: 'Бытие', es: 'Génesis' },
	{ de: '2. Mose', en: 'Exodus', fr: 'Exode', it: 'Esodo', pt: 'Êxodo', ru: 'Исход', es: 'Éxodo' },
	{ de: '3. Mose', en: 'Leviticus', fr: 'Lévitique', it: 'Levitico', pt: 'Levítico', ru: 'Левит', es: 'Levítico' },
	{ de: '4. Mose', en: 'Numbers', fr: 'Nombres', it: 'Numeri', pt: 'Números', ru: 'Числа', es: 'Números' },
	{ de: '5. Mose', en: 'Deuteronomy', fr: 'Deutéronome', it: 'Deuteronomio', pt: 'Deuteronómio', ru: 'Второзаконие', es: 'Deuteronomio' },
	{ de: 'Josua', en: 'Joshua', fr: 'Josué', it: 'Giosuè', pt: 'Josué', ru: 'Иисус Навин', es: 'Josué' },
	{ de: 'Richter', en: 'Judges', fr: 'Juges', it: 'Giudici', pt: 'Juízes', ru: 'Судей', es: 'Jueces' },
	{ de: 'Rut', en: 'Ruth', fr: 'Ruth', it: 'Rut', pt: 'Rute', ru: 'Руфь', es: 'Rut' },
	{ de: '1. Samuel', en: '1 Samuel', fr: '1 Samuel', it: '1 Samuele', pt: '1 Samuel', ru: '1 Самуила', es: '1 Samuel' },
	{ de: '2. Samuel', en: '2 Samuel', fr: '2 Samuel', it: '2 Samuele', pt: '2 Samuel', ru: '2 Самуила', es: '2 Samuel' },
	{ de: '1. Könige', en: '1 Kings', fr: '1 Rois', it: '1 Re', pt: '1 Reis', ru: '1 Царей', es: '1 Reyes' },
	{ de: '2. Könige', en: '2 Kings', fr: '2 Rois', it: '2 Re', pt: '2 Reis', ru: '2 Царей', es: '2 Reyes' },
	{ de: '1. Chronika', en: '1 Chronicles', fr: '1 Chroniques', it: '1 Cronache', pt: '1 Crónicas', ru: '1 Летопись', es: '1 Crónicas' },
	{ de: '2. Chronika', en: '2 Chronicles', fr: '2 Chroniques', it: '2 Cronache', pt: '2 Crónicas', ru: '2 Летопись', es: '2 Crónicas' },
	{ de: 'Esra', en: 'Ezra', fr: 'Esdras', it: 'Esdra', pt: 'Esdras', ru: 'Ездра', es: 'Esdras' },
	{ de: 'Nehemia', en: 'Nehemiah', fr: 'Néhémie', it: 'Neemia', pt: 'Neemias', ru: 'Неемия', es: 'Nehemías' },
	{ de: 'Ester', en: 'Esther', fr: 'Esther', it: 'Ester', pt: 'Ester', ru: 'Эсфирь', es: 'Ester' },
	{ de: 'Hiob', en: 'Job', fr: 'Job', it: 'Giobbe', pt: 'Jó', ru: 'Иов', es: 'Job' },
	{ de: 'Psalm', en: 'Psalm', fr: 'Psaumes', it: 'Salmi', pt: 'Salmos', ru: 'Псалмы', es: 'Salmos' },
	{ de: 'Sprüche', en: 'Proverbs', fr: 'Proverbes', it: 'Proverbi', pt: 'Provérbios', ru: 'Притчи', es: 'Proverbios' },
	{ de: 'Prediger', en: 'Ecclesiastes', fr: 'Ecclésiaste', it: 'Ecclesiaste', pt: 'Eclesiastes', ru: 'Экклезиаст', es: 'Eclesiastés' },
	{ de: 'Hoheslied', en: 'Song of Solomon', fr: 'Chant de Salomon', it: 'Cantico dei Cantici', pt: 'Cântico de Salomão', ru: 'Песня Соломона', es: 'El Cantar de los Cantares' },
	{ de: 'Jesaja', en: 'Isaiah', fr: 'Isaïe', it: 'Isaia', pt: 'Isaías', ru: 'Исайя', es: 'Isaías' },
	{ de: 'Jeremia', en: 'Jeremiah', fr: 'Jérémie', it: 'Geremia', pt: 'Jeremias', ru: 'Иеремия', es: 'Jeremías' },
	{ de: 'Klagelieder', en: 'Lamentations', fr: 'Lamentations', it: 'Lamentazioni', pt: 'Lamentações', ru: 'Плач Иеремии', es: 'Lamentaciones' },
	{ de: 'Hesekiel', en: 'Ezekiel', fr: 'Ézéchiel', it: 'Ezechiele', pt: 'Ezequiel', ru: 'Иезекииль', es: 'Ezequiel' },
	{ de: 'Daniel', en: 'Daniel', fr: 'Daniel', it: 'Daniele', pt: 'Daniel', ru: 'Даниил', es: 'Daniel' },
	{ de: 'Hosea', en: 'Hosea', fr: 'Osée', it: 'Osea', pt: 'Oseias', ru: 'Осия', es: 'Oseas' },
	{ de: 'Joel', en: 'Joel', fr: 'Joël', it: 'Gioele', pt: 'Joel', ru: 'Иоиль', es: 'Joel' },
	{ de: 'Amos', en: 'Amos', fr: 'Amos', it: 'Amos', pt: 'Amós', ru: 'Амос', es: 'Amós' },
	{ de: 'Obadja', en: 'Obadiah', fr: 'Abdias', it: 'Abdia', pt: 'Obadias', ru: 'Авдий', es: 'Abdías' },
	{ de: 'Jona', en: 'Jonah', fr: 'Jonas', it: 'Giona', pt: 'Jonas', ru: 'Иона', es: 'Jonás' },
	{ de: 'Micha', en: 'Micah', fr: 'Michée', it: 'Michea', pt: 'Miqueias', ru: 'Михей', es: 'Miqueas' },
	{ de: 'Nahum', en: 'Nahum', fr: 'Nahum', it: 'Naum', pt: 'Naum', ru: 'Наум', es: 'Nahúm' },
	{ de: 'Habakuk', en: 'Habakkuk', fr: 'Habacuc', it: 'Abacuc', pt: 'Habacuque', ru: 'Аввакум', es: 'Habacuc' },
	{ de: 'Zefanja', en: 'Zephaniah', fr: 'Sophonie', it: 'Sofonia', pt: 'Sofonias', ru: 'Софония', es: 'Sofonías' },
	{ de: 'Haggai', en: 'Haggai', fr: 'Aggée', it: 'Aggeo', pt: 'Ageu', ru: 'Аггей', es: 'Ageo' },
	{ de: 'Sacharja', en: 'Zechariah', fr: 'Zacharie', it: 'Zaccaria', pt: 'Zacarias', ru: 'Захария', es: 'Zacarías' },
	{ de: 'Maleachi', en: 'Malachi', fr: 'Malachie', it: 'Malachia', pt: 'Malaquias', ru: 'Малахия', es: 'Malaquías' },
	{ de: 'Matthäus', en: 'Matthew', fr: 'Matthieu', it: 'Matteo', pt: 'Mateus', ru: 'Матфея', es: 'Mateo' },
	{ de: 'Markus', en: 'Mark', fr: 'Marc', it: 'Marco', pt: 'Marcos', ru: 'Марка', es: 'Marcos' },
	{ de: 'Lukas', en: 'Luke', fr: 'Luc', it: 'Luca', pt: 'Lucas', ru: 'Луки', es: 'Lucas' },
	{ de: 'Johannes', en: 'John', fr: 'Jean', it: 'Giovanni', pt: 'João', ru: 'Иоанна', es: 'Juan' },
	{ de: 'Apostelgeschichte', en: 'Acts', fr: 'Actes', it: 'Atti', pt: 'Atos', ru: 'Деяния', es: 'Hechos' },
	{ de: 'Römer', en: 'Romans', fr: 'Romains', it: 'Romani', pt: 'Romanos', ru: 'Римлянам', es: 'Romanos' },
	{ de: '1. Korinther', en: '1 Corinthians', fr: '1 Corinthiens', it: '1 Corinti', pt: '1 Coríntios', ru: '1 Коринфянам', es: '1 Corintios' },
	{ de: '2. Korinther', en: '2 Corinthians', fr: '2 Corinthiens', it: '2 Corinti', pt: '2 Coríntios', ru: '2 Коринфянам', es: '2 Corintios' },
	{ de: 'Galater', en: 'Galatians', fr: 'Galates', it: 'Galati', pt: 'Gálatas', ru: 'Галатам', es: 'Gálatas' },
	{ de: 'Epheser', en: 'Ephesians', fr: 'Éphésiens', it: 'Efesini', pt: 'Efésios', ru: 'Эфесянам', es: 'Efesios' },
	{ de: 'Philipper', en: 'Philippians', fr: 'Philippiens', it: 'Filippesi', pt: 'Filipenses', ru: 'Филиппийцам', es: 'Filipenses' },
	{ de: 'Kolosser', en: 'Colossians', fr: 'Colossiens', it: 'Colossesi', pt: 'Colossenses', ru: 'Колоссянам', es: 'Colosenses' },
	{ de: '1. Thessalonicher', en: '1 Thessalonians', fr: '1 Thessaloniciens', it: '1 Tessalonicesi', pt: '1 Tessalonicenses', ru: '1 Фессалоникийцам', es: '1 Tesalonicenses' },
	{ de: '2. Thessalonicher', en: '2 Thessalonians', fr: '2 Thessaloniciens', it: '2 Tessalonicesi', pt: '2 Tessalonicenses', ru: '2 Фессалоникийцам', es: '2 Tesalonicenses' },
	{ de: '1. Timotheus', en: '1 Timothy', fr: '1 Timothée', it: '1 Timoteo', pt: '1 Timóteo', ru: '1 Тимофею', es: '1 Timoteo' },
	{ de: '2. Timotheus', en: '2 Timothy', fr: '2 Timothée', it: '2 Timoteo', pt: '2 Timóteo', ru: '2 Тимофею', es: '2 Timoteo' },
	{ de: 'Titus', en: 'Titus', fr: 'Tite', it: 'Tito', pt: 'Tito', ru: 'Титу', es: 'Tito' },
	{ de: 'Philemon', en: 'Philemon', fr: 'Philémon', it: 'Filemone', pt: 'Filémon', ru: 'Филимону', es: 'Filemón' },
	{ de: 'Hebräer', en: 'Hebrews', fr: 'Hébreux', it: 'Ebrei', pt: 'Hebreus', ru: 'Евреям', es: 'Hebreos' },
	{ de: 'Jakobus', en: 'James', fr: 'Jacques', it: 'Giacomo', pt: 'Tiago', ru: 'Иакова', es: 'Santiago' },
	{ de: '1. Petrus', en: '1 Peter', fr: '1 Pierre', it: '1 Pietro', pt: '1 Pedro', ru: '1 Петра', es: '1 Pedro' },
	{ de: '2. Petrus', en: '2 Peter', fr: '2 Pierre', it: '2 Pietro', pt: '2 Pedro', ru: '2 Петра', es: '2 Pedro' },
	{ de: '1. Johannes', en: '1 John', fr: '1 Jean', it: '1 Giovanni', pt: '1 João', ru: '1 Иоанна', es: '1 Juan' },
	{ de: '2. Johannes', en: '2 John', fr: '2 Jean', it: '2 Giovanni', pt: '2 João', ru: '2 Иоанна', es: '2 Juan' },
	{ de: '3. Johannes', en: '3 John', fr: '3 Jean', it: '3 Giovanni', pt: '3 João', ru: '3 Иоанна', es: '3 Juan' },
	{ de: 'Judas', en: 'Jude', fr: 'Jude', it: 'Giuda', pt: 'Judas', ru: 'Иуды', es: 'Judas' },
	{ de: 'Offenbarung', en: 'Revelation', fr: 'Révélation', it: 'Rivelazione', pt: 'Apocalipse', ru: 'Откровение', es: 'Apocalipsis' },
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
 * Reverse lookup: a book name typed as plain text (any casing/punctuation,
 * e.g. "psalm", "1. Mose", "1 mose") → canonical book number — used to
 * recognize a scripture reference typed as plain text (see
 * ScriptureTextParser). Limited to `SupportedLang` (the settings/popup
 * language), matching the scope of that feature.
 *
 * Falls back to prefix matching when there's no exact match — this alone
 * covers most real-world citation abbreviations, since they're almost always
 * a literal truncation of the full name ("Matth." → "Matthäus", "Ps" →
 * "Psalm", "1 Mo" → "1. Mose"), without needing a separate abbreviation
 * table that isn't present in any local file to verify against (unlike
 * "Jn" for "John", which skips letters rather than truncating — not
 * resolvable this way). A prefix is only accepted when it resolves to
 * exactly ONE book; an ambiguous one (e.g. "Jo", which prefixes "Johannes",
 * "Joel" and "Jona") is rejected rather than guessed at.
 */
export function lookupBookNumber(rawName: string, lang: SupportedLang): number | undefined {
	const map = getLookupMap(lang);
	const key = normalizeBookKey(rawName);

	const exact = map.get(key);
	if (exact !== undefined) return exact;
	if (key.length < MIN_ABBREVIATION_LENGTH) return undefined;

	let match: number | undefined;
	for (const [fullKey, bookNumber] of map) {
		if (!fullKey.startsWith(key)) continue;
		if (match !== undefined) return undefined; // ambiguous prefix — reject
		match = bookNumber;
	}
	return match;
}
