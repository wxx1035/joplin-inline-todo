import { PeriodType, StatBlockConfig } from './types';

const START_RE = /<!--\s*plugin-statistic-any:start([\s\S]*?)-->/g;

function parseLine(line: string): [string, string] | undefined {
	const idx = line.indexOf('=');
	if (idx < 0) return undefined;
	const k = line.slice(0, idx).trim();
	const v = line.slice(idx + 1).trim();
	if (!k) return undefined;
	return [k, v];
}

function normalizePeriod(v?: string): PeriodType {
	const value = (v || 'all') as PeriodType;
	const supported = new Set(['all', 'thisMonth', 'lastMonth', 'thisYear', 'custom']);
	return supported.has(value) ? value : 'all';
}

export function parseBlockConfig(rawConfig: string): StatBlockConfig | undefined {
	const lines = rawConfig.split('\n').map(s => s.trim()).filter(Boolean);
	const map: Record<string, string> = {};
	for (const line of lines) {
		const parsed = parseLine(line);
		if (!parsed) continue;
		map[parsed[0]] = parsed[1];
	}

	if (!map.key) return undefined;
	const config: StatBlockConfig = {
		key: map.key,
		period: normalizePeriod(map.period),
	};
	if (map.folder) config.folder = map.folder;
	if (map.from) config.from = map.from;
	if (map.to) config.to = map.to;
	return config;
}

export function findStatisticBlocks(body: string): { startTag: string; endTag: string; config: StatBlockConfig }[] {
	const result: { startTag: string; endTag: string; config: StatBlockConfig }[] = [];
	let match: RegExpExecArray | null;
	START_RE.lastIndex = 0;
	while ((match = START_RE.exec(body)) !== null) {
		const startTag = match[0];
		const config = parseBlockConfig(match[1]);
		if (!config) continue;
		const endTag = '<!-- plugin-statistic-any:end -->';
		result.push({ startTag, endTag, config });
	}
	return result;
}

export function renderStatisticValue(config: StatBlockConfig, sum: number): string {
	return `${config.key}: ${sum}`;
}

export function replaceBlockContent(body: string, startTag: string, endTag: string, replacement: string): string {
	const startIndex = body.indexOf(startTag);
	if (startIndex < 0) return body;
	const endIndex = body.indexOf(endTag, startIndex + startTag.length);
	if (endIndex < 0) return body;
	const before = body.slice(0, startIndex + startTag.length);
	const after = body.slice(endIndex);
	return `${before}\n\n${replacement}\n\n${after}`;
}
