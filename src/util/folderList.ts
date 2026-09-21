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

/** Every folder whose own NAME (not path) is `name`, in path order — how the
 *  bulk update pairs a re-parsed programme file with the folder its first
 *  import created. Matching on the name rather than the path is what makes it
 *  work for a vault that keeps its conventions in a subfolder; several matches
 *  are a real possibility (the same name under two parents), which is why the
 *  caller gets the whole list and lets the user settle it. */
export function findFoldersByName(app: App, name: string): TFolder[] {
	return listAllFolders(app).filter(folder => folder.name === name);
}
