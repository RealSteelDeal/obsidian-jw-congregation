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

export const jiti = createJiti(import.meta.url);
