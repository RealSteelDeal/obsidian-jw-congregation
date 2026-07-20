/**
 * Shared test bootstrap: lets .test.mjs files import the TypeScript sources
 * directly (via jiti, no separate build step) and provides the DOMParser
 * global that the jwpub parser expects from its Electron/Obsidian host.
 */
import { parseHTML } from 'linkedom';
import { createJiti } from 'jiti';

globalThis.DOMParser = class {
	parseFromString(html) {
		return parseHTML(html).document;
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
