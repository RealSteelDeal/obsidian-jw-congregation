/**
 * Unit tests for MwbSourceRouter's format/publication-type detection. Full
 * jwpub decryption isn't exercised here (no encrypted fixture — same policy
 * as jwpubParser.test.mjs); these only cover the routing decision itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { MwbSourceRouter } = await jiti.import('../src/parser/MwbSourceRouter.ts');

function router() {
	return new MwbSourceRouter(new Uint8Array());
}

test('route() rejects a filename/content that does not look like a jwpub file at all', async () => {
	await assert.rejects(
		() => router().route('program.txt', new Uint8Array([1, 2, 3, 4])),
		err => err.code === 'unknownFormat',
	);
});

test('route() accepts anything with a PK zip signature regardless of extension, then fails later on Publication', async () => {
	// A bare PK-signature blob isn't a real zip, so opening it as a database
	// fails downstream — but it must NOT be rejected at the unknownFormat
	// stage just because the extension is missing/wrong (mirrors
	// SourceRouter's own isJwpub() behavior).
	const pkSignature = new Uint8Array([0x50, 0x4b, 0, 0]);
	await assert.rejects(() => router().route('no-extension', pkSignature), err => err.code !== 'unknownFormat');
});
