/**
 * Shared test bootstrap: lets .test.mjs files import the TypeScript sources
 * directly (via jiti, no separate build step) and provides the DOMParser
 * global that the jwpub parser expects from its Electron/Obsidian host.
 */
import { parseHTML } from 'linkedom';
import { createJiti } from 'jiti';

globalThis.DOMParser = class {
	parseFromString(html) {
		// linkedom's parseHTML() infers document structure from the input
		// instead of always guaranteeing one, unlike a real browser DOMParser:
		// a single top-level element (e.g. "<strong>5</strong>") becomes the
		// document's root itself (no <body> at all, so .body.textContent silently
		// reads as ''), and plain text with no tag at all (e.g. a bare verse
		// number like "1") produces no documentElement whatsoever (.body throws).
		// Wrapping every input in an explicit <html><body> forces linkedom to
		// always parse it as fragment content instead, matching how a real
		// DOMParser behaves regardless of what's inside.
		return parseHTML(`<html><body>${html}</body></html>`).document;
	}
};

// BibleReader.ts uses Node.TEXT_NODE and Obsidian's own Electron-patched
// `.instanceOf()` convenience method (not standard DOM, not provided by
// linkedom) — polyfilled here so its DOM-parsing methods are testable the
// same way as JwpubParser's.
const { Node, HTMLElement } = await import('linkedom');
globalThis.Node = Node;
globalThis.HTMLElement = HTMLElement;
Node.prototype.instanceOf = function (ctor) { return this instanceof ctor; };

export const jiti = createJiti(import.meta.url);
