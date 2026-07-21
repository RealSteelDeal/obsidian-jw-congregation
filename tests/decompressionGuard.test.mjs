import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { assertFileSize, assertUnpackedEntrySize, assertInflatedBlobSize, MAX_INPUT_FILE_BYTES, MAX_INFLATED_BLOB_BYTES } =
	await jiti.import('../src/util/decompressionGuard.ts');

test('assertFileSize does not throw for a normal-sized buffer', () => {
	assert.doesNotThrow(() => assertFileSize(new Uint8Array(1024)));
});

test('assertFileSize throws a ParseError once the input exceeds the ceiling', () => {
	const oversized = { byteLength: MAX_INPUT_FILE_BYTES + 1 };
	assert.throws(() => assertFileSize(oversized), err => err.code === 'fileTooLarge');
});

test('assertUnpackedEntrySize throws a ParseError once a decompressed entry exceeds the ceiling', () => {
	const oversized = { byteLength: MAX_INPUT_FILE_BYTES + 1 };
	assert.throws(() => assertUnpackedEntrySize(oversized), err => err.code === 'decompressedTooLarge');
});

test('assertInflatedBlobSize does not throw for a normal-sized document blob', () => {
	assert.doesNotThrow(() => assertInflatedBlobSize(new Uint8Array(1024)));
});

test('assertInflatedBlobSize throws a ParseError once a single inflated blob exceeds its (smaller) ceiling', () => {
	const oversized = { byteLength: MAX_INFLATED_BLOB_BYTES + 1 };
	assert.throws(() => assertInflatedBlobSize(oversized), err => err.code === 'decompressedTooLarge');
});
