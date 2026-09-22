import { CongressLang } from './bookNames';
import { ScriptureNormalizer } from './ScriptureNormalizer';

/**
 * Song number → the `docid` of the jw.org/finder link that opens it in JW
 * Library.
 *
 * Read out of the official songbook jwpub (`sjj`, 2026) with
 * `scripts/dump-song-docids.mjs`, never computed. The naive
 * `1102016800 + songNumber` holds for most songs but is wrong for **12 of the
 * 163** — among them Lied 160, whose real id is 1102022960 where the formula
 * predicts 1102016960. Until this table existed the RTF import path had no
 * better option than that formula, so roughly 7 % of its song links pointed
 * at the wrong publication.
 *
 * Where the number and the id come from: `Document.ChapterNumber` and
 * `Document.MepsDocumentId`. Not the title (those are song titles, not
 * numbers) and not the position (front matter and indexes sit among the
 * songs) — both were tried first and both were wrong.
 *
 * The ids are **language-independent**, which is why one table serves all
 * seven languages: a link carries its language in `wtlocale=`. Established on
 * 22.09.2026 against the German, English and Russian convention programmes —
 * 36 songs, identical ids in all three — and the table was cross-checked
 * against the 18 songs the real parser reads out of a programme file, plus
 * the four ids NoteBuilder.songLink had already documented from real shared
 * links.
 *
 * A song missing here gets no link rather than a guessed one; see
 * NoteBuilder.songLink().
 */
export const SONG_DOC_IDS: Readonly<Record<number, number>> = {
	1: 1102016801, 2: 1102016802, 3: 1102016803, 4: 1102016804, 5: 1102016805, 6: 1102016806,
	7: 1102016807, 8: 1102016808, 9: 1102016809, 10: 1102016810, 11: 1102016811, 12: 1102016812,
	13: 1102016813, 14: 1102016814, 15: 1102016815, 16: 1102016816, 17: 1102016817, 18: 1102016818,
	19: 1102016819, 20: 1102016820, 21: 1102016821, 22: 1102016822, 23: 1102016823, 24: 1102016824,
	25: 1102016825, 26: 1102016826, 27: 1102016827, 28: 1102016828, 29: 1102016829, 30: 1102016830,
	31: 1102016831, 32: 1102016832, 33: 1102016833, 34: 1102016834, 35: 1102016835, 36: 1102016836,
	37: 1102016837, 38: 1102016838, 39: 1102016839, 40: 1102016840, 41: 1102016841, 42: 1102016842,
	43: 1102016843, 44: 1102016844, 45: 1102016845, 46: 1102016846, 47: 1102016847, 48: 1102016848,
	49: 1102016849, 50: 1102016850, 51: 1102016851, 52: 1102016852, 53: 1102016853, 54: 1102016854,
	55: 1102016855, 56: 1102016856, 57: 1102016857, 58: 1102016858, 59: 1102016859, 60: 1102016860,
	61: 1102016861, 62: 1102016862, 63: 1102016863, 64: 1102016864, 65: 1102016865, 66: 1102016866,
	67: 1102016867, 68: 1102016868, 69: 1102016869, 70: 1102016870, 71: 1102016871, 72: 1102016872,
	73: 1102016873, 74: 1102016874, 75: 1102016875, 76: 1102016876, 77: 1102016877, 78: 1102016878,
	79: 1102016879, 80: 1102016880, 81: 1102016881, 82: 1102016882, 83: 1102016883, 84: 1102016884,
	85: 1102016885, 86: 1102016886, 87: 1102016887, 88: 1102016888, 89: 1102016889, 90: 1102016890,
	91: 1102016891, 92: 1102016892, 93: 1102016893, 94: 1102016894, 95: 1102016895, 96: 1102016896,
	97: 1102016897, 98: 1102016898, 99: 1102016899, 100: 1102016900, 101: 1102016901, 102: 1102016902,
	103: 1102016903, 104: 1102016904, 105: 1102016905, 106: 1102016906, 107: 1102016907, 108: 1102016908,
	109: 1102016909, 110: 1102016910, 111: 1102016911, 112: 1102016912, 113: 1102016913, 114: 1102016914,
	115: 1102016915, 116: 1102016916, 117: 1102016917, 118: 1102016918, 119: 1102016919, 120: 1102016920,
	121: 1102016921, 122: 1102016922, 123: 1102016923, 124: 1102016924, 125: 1102016925, 126: 1102016926,
	127: 1102016927, 128: 1102016928, 129: 1102016929, 130: 1102016930, 131: 1102016931, 132: 1102016932,
	133: 1102016933, 134: 1102016934, 135: 1102016935, 136: 1102016936, 137: 1102016937, 138: 1102016938,
	139: 1102016939, 140: 1102016940, 141: 1102016941, 142: 1102016942, 143: 1102016943, 144: 1102016944,
	145: 1102016945, 146: 1102016946, 147: 1102016947, 148: 1102016948, 149: 1102016949, 150: 1102016950,
	151: 1102016951, 152: 1102022952, 153: 1102022953, 154: 1102022954, 155: 1102022955, 156: 1102022956,
	157: 1102022957, 158: 1102022958, 159: 1102022959, 160: 1102022960, 161: 1102022961, 162: 1102022962,
	163: 1102022963,
};

/**
 * The jw.org/finder link that opens a song in JW Library, or undefined when
 * the song is not one this plugin can address.
 *
 * The one URL shape confirmed to work on a real device, copied byte for byte
 * from JW Library's own "Share" — `pub=`/`track=`, `lank=` and every
 * `jwlibrary://` variant were tried and bounced (see NoteBuilder.songLink).
 * Shared by the note builders and the as-you-type suggestion so a song link
 * has exactly one definition.
 */
export function songFinderUrl(songNumber: number, lang: CongressLang, songDocid?: number): string | undefined {
	const docid = songDocid ?? SONG_DOC_IDS[songNumber];
	if (docid === undefined) return undefined;
	return `https://www.jw.org/finder?srcid=jwlshare&wtlocale=${ScriptureNormalizer.wtlocale(lang)}&prefer=lang&docid=${docid}`;
}

/**
 * A song number written as plain text at the END of `text`, e.g. "Lied 45".
 *
 * The wording comes from NoteBuilder.splitSongTitle, whose pattern was
 * verified against real programme files in each of the seven languages —
 * including the "No."/"no"/"№" infix that only some of them use. Only songs
 * the table knows are reported: an unknown number has no link to offer, so
 * announcing it would promise something that cannot follow.
 */
export function findSongNumberAtEnd(text: string): { songNumber: number; start: number; end: number } | undefined {
	const match = /(?:^|[\s([])((?:Lied|Song|Cantique|Cantico|Cântico|Песня|Canción)(?:\s+(?:No\.|no|№))?\s+(\d{1,3}))$/iu.exec(text);
	if (!match?.[1] || !match[2]) return undefined;
	const songNumber = Number(match[2]);
	if (SONG_DOC_IDS[songNumber] === undefined) return undefined;
	return { songNumber, start: text.length - match[1].length, end: text.length };
}
