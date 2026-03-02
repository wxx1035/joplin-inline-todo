import { getDateRange, inDateRange } from './period';
import { parseStatEntries } from './parser';
import { FolderLike, NoteLike, StatBlockConfig } from './types';

function shouldKeepFolder(note: NoteLike, config: StatBlockConfig, folderMap: Record<string, string>): boolean {
	if (!config.folder) return true;
	return folderMap[note.parent_id] === config.folder;
}

export function aggregateForConfig(
	notes: NoteLike[],
	config: StatBlockConfig,
	folderMap: Record<string, string>,
	now = new Date(),
): number {
	const range = getDateRange(config.period, now, config.from, config.to);
	let sum = 0;
	for (const note of notes) {
		if (note.is_conflict) continue;
		if (!shouldKeepFolder(note, config, folderMap)) continue;
		const entries = parseStatEntries(note)
			.filter(e => e.key === config.key)
			.filter(e => inDateRange(e.date, range));
		for (const e of entries) sum += e.value;
	}
	return sum;
}

export function toFolderMap(folders: FolderLike[]): Record<string, string> {
	return Object.fromEntries(folders.map(f => [f.id, f.title]));
}
