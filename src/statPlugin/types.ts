export interface NoteLike {
	id: string;
	parent_id: string;
	body: string;
	created_time: number;
	is_conflict?: boolean;
}

export type PeriodType = 'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export interface StatBlockConfig {
	key: string;
	period: PeriodType;
	folder?: string;
	from?: string;
	to?: string;
}

export interface StatEntry {
	key: string;
	value: number;
	date: string;
	noteId: string;
	parentId: string;
}

export interface DateRange {
	from?: Date;
	to?: Date;
}

export interface FolderLike {
	id: string;
	title: string;
}
