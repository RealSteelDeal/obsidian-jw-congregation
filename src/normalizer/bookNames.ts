export type SupportedLang = 'de' | 'en';

interface BookEntry {
	de: string;
	en: string;
}

// Index 0 = book 1 (Genesis) … index 65 = book 66 (Revelation)
const BOOK_NAMES: BookEntry[] = [
	{ de: '1. Mose',         en: 'Genesis' },
	{ de: '2. Mose',         en: 'Exodus' },
	{ de: '3. Mose',         en: 'Leviticus' },
	{ de: '4. Mose',         en: 'Numbers' },
	{ de: '5. Mose',         en: 'Deuteronomy' },
	{ de: 'Josua',           en: 'Joshua' },
	{ de: 'Richter',         en: 'Judges' },
	{ de: 'Rut',             en: 'Ruth' },
	{ de: '1. Samuel',       en: '1 Samuel' },
	{ de: '2. Samuel',       en: '2 Samuel' },
	{ de: '1. Könige',       en: '1 Kings' },
	{ de: '2. Könige',       en: '2 Kings' },
	{ de: '1. Chronika',     en: '1 Chronicles' },
	{ de: '2. Chronika',     en: '2 Chronicles' },
	{ de: 'Esra',            en: 'Ezra' },
	{ de: 'Nehemia',         en: 'Nehemiah' },
	{ de: 'Ester',           en: 'Esther' },
	{ de: 'Hiob',            en: 'Job' },
	{ de: 'Psalm',           en: 'Psalm' },
	{ de: 'Sprüche',         en: 'Proverbs' },
	{ de: 'Prediger',        en: 'Ecclesiastes' },
	{ de: 'Hoheslied',       en: 'Song of Solomon' },
	{ de: 'Jesaja',          en: 'Isaiah' },
	{ de: 'Jeremia',         en: 'Jeremiah' },
	{ de: 'Klagelieder',     en: 'Lamentations' },
	{ de: 'Hesekiel',        en: 'Ezekiel' },
	{ de: 'Daniel',          en: 'Daniel' },
	{ de: 'Hosea',           en: 'Hosea' },
	{ de: 'Joel',            en: 'Joel' },
	{ de: 'Amos',            en: 'Amos' },
	{ de: 'Obadja',          en: 'Obadiah' },
	{ de: 'Jona',            en: 'Jonah' },
	{ de: 'Micha',           en: 'Micah' },
	{ de: 'Nahum',           en: 'Nahum' },
	{ de: 'Habakuk',         en: 'Habakkuk' },
	{ de: 'Zefanja',         en: 'Zephaniah' },
	{ de: 'Haggai',          en: 'Haggai' },
	{ de: 'Sacharja',        en: 'Zechariah' },
	{ de: 'Maleachi',        en: 'Malachi' },
	{ de: 'Matthäus',        en: 'Matthew' },
	{ de: 'Markus',          en: 'Mark' },
	{ de: 'Lukas',           en: 'Luke' },
	{ de: 'Johannes',        en: 'John' },
	{ de: 'Apostelgeschichte', en: 'Acts' },
	{ de: 'Römer',           en: 'Romans' },
	{ de: '1. Korinther',    en: '1 Corinthians' },
	{ de: '2. Korinther',    en: '2 Corinthians' },
	{ de: 'Galater',         en: 'Galatians' },
	{ de: 'Epheser',         en: 'Ephesians' },
	{ de: 'Philipper',       en: 'Philippians' },
	{ de: 'Kolosser',        en: 'Colossians' },
	{ de: '1. Thessalonicher', en: '1 Thessalonians' },
	{ de: '2. Thessalonicher', en: '2 Thessalonians' },
	{ de: '1. Timotheus',    en: '1 Timothy' },
	{ de: '2. Timotheus',    en: '2 Timothy' },
	{ de: 'Titus',           en: 'Titus' },
	{ de: 'Philemon',        en: 'Philemon' },
	{ de: 'Hebräer',         en: 'Hebrews' },
	{ de: 'Jakobus',         en: 'James' },
	{ de: '1. Petrus',       en: '1 Peter' },
	{ de: '2. Petrus',       en: '2 Peter' },
	{ de: '1. Johannes',     en: '1 John' },
	{ de: '2. Johannes',     en: '2 John' },
	{ de: '3. Johannes',     en: '3 John' },
	{ de: 'Judas',           en: 'Jude' },
	{ de: 'Offenbarung',     en: 'Revelation' },
];

export function getBookName(bookNumber: number, lang: SupportedLang): string {
	const entry = BOOK_NAMES[bookNumber - 1];
	if (!entry) throw new Error(`Invalid book number: ${bookNumber}`);
	return entry[lang];
}
