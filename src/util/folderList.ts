import { App, TFolder } from 'obsidian';

/** Every folder in the vault except the root itself, sorted by path — shared
 *  by every "pick a target folder" modal (ImportModal, UpdateNotesModal,
 *  ImportMwbModal, UpdateMwbNotesModal). */
export function listAllFolders(app: App): TFolder[] {
	const folders: TFolder[] = [];
	const collect = (folder: TFolder) => {
		if (folder.path !== '/') folders.push(folder);
		for (const child of folder.children) {
			if (child instanceof TFolder) collect(child);
		}
	};
	collect(app.vault.getRoot());
	folders.sort((a, b) => a.path.localeCompare(b.path));
	return folders;
}
