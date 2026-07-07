/**
 * Extracts a single version's section from CHANGELOG.md (everything between
 * its "## x.y.z" heading and the next one) for use as GitHub release notes.
 * Usage: node scripts/extract-changelog.mjs <version>
 */
import { readFileSync } from 'fs';

const version = process.argv[2];
if (!version) {
	console.error('Usage: node scripts/extract-changelog.mjs <version>');
	process.exit(1);
}

const changelog = readFileSync('CHANGELOG.md', 'utf-8');
const lines = changelog.split('\n');

const startIdx = lines.findIndex(l => l.trim() === `## ${version}`);
if (startIdx === -1) {
	console.error(`Version "${version}" nicht in CHANGELOG.md gefunden.`);
	process.exit(1);
}

let endIdx = lines.findIndex((l, i) => i > startIdx && /^## /.test(l));
if (endIdx === -1) endIdx = lines.length;

console.log(lines.slice(startIdx + 1, endIdx).join('\n').trim());
