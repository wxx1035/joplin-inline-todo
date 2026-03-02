import { NoteLike, StatEntry } from './types';

// spec regex: /^📊\s+([a-zA-Z0-9_-]+)\s+(\d+(\.\d+)?)(?:\s+@(\d{{4}}-\d{{2}}-\d{{2}}))?/gm
// 实现时允许每行前导空格，且 number 非法时按 0 处理
const LINE_REGEX = /^\s*📊\s+([a-zA-Z0-9_-]+)\s+([^\s]+)(?:\s+@(\d{4}-\d{2}-\d{2}))?\s*$/gm;

function isoFromCreatedTime(created: number): string {
	return new Date(created).toISOString().slice(0, 10);
}

function parseNumberOrZero(raw: string): number {
	const n = Number(raw);
	if (Number.isNaN(n)) return 0;
	return n;
}

function pickDate(rawDate: string | undefined, createdTime: number): string {
	if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
	return isoFromCreatedTime(createdTime);
}

export function parseStatEntries(note: NoteLike): StatEntry[] {
	const entries: StatEntry[] = [];
	let match: RegExpExecArray | null;
	LINE_REGEX.lastIndex = 0;

	while ((match = LINE_REGEX.exec(note.body)) !== null) {
		entries.push({
			key: match[1],
			value: parseNumberOrZero(match[2]),
			date: pickDate(match[3], note.created_time),
			noteId: note.id,
			parentId: note.parent_id,
		});
	}

	return entries;
}
