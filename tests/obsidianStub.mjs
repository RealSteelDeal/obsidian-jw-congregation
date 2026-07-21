/**
 * Minimal hand-rolled stand-in for the parts of the real `obsidian` package
 * that main.ts (and, transitively, everything it imports — settings.ts and
 * every ui/*.ts modal) needs at MODULE-LOAD time. This does not attempt to
 * behave like the real Obsidian API — it only needs to (a) let jiti resolve
 * `import ... from 'obsidian'` without throwing, and (b) support the small
 * slice of behavior importFile()/updateFile() actually exercise (vault
 * read/write/create, TFile/TFolder identity checks, Notice construction).
 * Every other export (Setting, Modal, PluginSettingTab, EditorSuggest, ...)
 * is a bare, unused-in-tests stub — their real methods are never invoked
 * here, since these tests never open a modal or render the settings tab,
 * only call JwCongregationPlugin's own importFile()/updateFile() methods.
 */

export class TFile {
	constructor(path) { this.path = path; }
}

export class TFolder {
	constructor(path) { this.path = path; this.children = []; }
}

export function normalizePath(path) {
	// Real normalizePath does more (Unicode NFC, drive-letter handling, …) —
	// deliberately simplified to just what the plugin's own path joining
	// (main.ts resolvePath()/ensureFolder()) actually needs.
	return path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '');
}

export class Notice {
	/** Test hook: every constructed Notice, in order — reset between tests. */
	static instances = [];

	constructor(message, timeout) {
		this.message = message;
		this.timeout = timeout;
		this._clickHandlers = [];
		this.noticeEl = {
			addEventListener: (type, handler) => {
				if (type === 'click') this._clickHandlers.push(handler);
			},
		};
		Notice.instances.push(this);
	}
	setMessage(message) { this.message = message; }
	hide() {}
	/** Test helper, not part of the real Notice API. */
	_click() { this._clickHandlers.forEach(h => h()); }
}

export class Component {
	registerEvent() {}
	registerDomEvent() {}
	registerEditorSuggest() {}
	addChild() {}
	removeChild() {}
}

export class Plugin extends Component {
	constructor(app, manifest) {
		super();
		this.app = app;
		this.manifest = manifest;
	}
	addRibbonIcon() {}
	addCommand() {}
	addSettingTab() {}
	loadData() { return Promise.resolve(null); }
	saveData() { return Promise.resolve(); }
}

export class PluginSettingTab {
	constructor(app, plugin) { this.app = app; this.plugin = plugin; }
}

// None of these Setting/Modal/EditorSuggest methods are ever invoked by the
// main.ts tests (they belong to settings.ts's display()/getSettingDefinitions()
// and the ui/*.ts modals' onOpen(), none of which these tests call) — they
// only need to exist so the corresponding modules load without throwing.
export class Setting {
	constructor() {}
	setName() { return this; }
	setDesc() { return this; }
	setHeading() { return this; }
	addToggle() { return this; }
	addButton() { return this; }
	addExtraButton() { return this; }
	addDropdown() { return this; }
	addText() { return this; }
	addTextArea() { return this; }
}

export class Modal {
	constructor(app) { this.app = app; }
	open() {}
	close() {}
}

export class EditorSuggest {
	constructor(app) { this.app = app; }
}

export function setIcon() {}

export function requireApiVersion() { return true; }
