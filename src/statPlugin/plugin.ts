import joplin from 'api';
import { aggregateForConfig, toFolderMap } from './aggregate';
import { findStatisticBlocks, renderStatisticValue, replaceBlockContent } from './block';
import { NoteLike } from './types';

async function listAllNotes(): Promise<NoteLike[]> {
	const notes: NoteLike[] = [];
	let page = 0;
	let r;
	do {
		page += 1;
		r = await joplin.data.get(['notes'], {
			fields: ['id', 'parent_id', 'body', 'created_time', 'is_conflict'],
			page,
			limit: 100,
		});
		notes.push(...r.items);
	} while (r.has_more);
	return notes;
}

async function listAllFolders() {
	const folders = [];
	let page = 0;
	let r;
	do {
		page += 1;
		r = await joplin.data.get(['folders'], { fields: ['id', 'title'], page, limit: 100 });
		folders.push(...r.items);
	} while (r.has_more);
	return folders;
}

export async function refreshStatisticNote(noteId: string) {
	const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'body'] });
	let body = note.body as string;
	const blocks = findStatisticBlocks(body);
	if (blocks.length === 0) return;

	const [notes, folders] = await Promise.all([listAllNotes(), listAllFolders()]);
	const folderMap = toFolderMap(folders);

	for (const block of blocks) {
		const sum = aggregateForConfig(notes, block.config, folderMap);
		const content = renderStatisticValue(block.config, sum);
		body = replaceBlockContent(body, block.startTag, block.endTag, content);
	}

	if (body !== note.body) {
		await joplin.data.put(['notes', noteId], null, { body });
	}
}

export async function registerStatisticPlugin() {
	await joplin.commands.register({
		name: 'statistic.refreshCurrentNote',
		label: 'Refresh statistic blocks',
		execute: async () => {
			const current = await joplin.workspace.selectedNote();
			if (!current) return;
			await refreshStatisticNote(current.id);
		},
	});

	await joplin.workspace.onNoteSelectionChange(async () => {
		const current = await joplin.workspace.selectedNote();
		if (!current?.id || !current?.body?.includes('plugin-statistic-any:start')) return;
		await refreshStatisticNote(current.id);
	});
}
