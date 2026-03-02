import { parseStatEntries } from './parser';
import { aggregateForConfig } from './aggregate';
import { findStatisticBlocks, replaceBlockContent } from './block';
import { getDateRange, inDateRange } from './period';

const notes = [
	{
		id: 'n1',
		parent_id: 'f1',
		body: '📊 overtime 100\n📊 overtime 50 @2026-02-26\n📊 study 30',
		created_time: Date.parse('2026-02-20T00:00:00Z'),
	},
	{
		id: 'n2',
		parent_id: 'f2',
		body: '📊 overtime 20 @2026-03-01\n📊 overtime abc @2026-02-10',
		created_time: Date.parse('2026-02-10T00:00:00Z'),
	},
];

describe('stat plugin core', () => {
	test('parse entries with default date and invalid number->0', () => {
		const entries = parseStatEntries(notes[1] as any);
		expect(entries).toHaveLength(2);
		expect(entries[1].value).toBe(0);
		expect(entries[1].date).toBe('2026-02-10');
	});

	test('aggregate by key with period and folder', () => {
		const sum = aggregateForConfig(
			notes as any,
			{ key: 'overtime', period: 'thisMonth', folder: 'work' },
			{ f1: 'work', f2: 'life' },
			new Date('2026-02-28T00:00:00Z'),
		);
		expect(sum).toBe(150);
	});

	test('custom period range works', () => {
		const r = getDateRange('custom', new Date('2026-03-01T00:00:00Z'), '2026-02-01', '2026-02-28');
		expect(inDateRange('2026-02-10', r)).toBe(true);
		expect(inDateRange('2026-03-01', r)).toBe(false);
	});

	test('find and replace statistic block', () => {
		const body = `hello\n<!-- plugin-statistic-any:start\nkey=overtime\nperiod=thisMonth\nfolder=work\n-->\n\n<!-- plugin-statistic-any:end -->`;
		const blocks = findStatisticBlocks(body);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].config.key).toBe('overtime');
		const newBody = replaceBlockContent(body, blocks[0].startTag, blocks[0].endTag, 'overtime: 150');
		expect(newBody).toContain('overtime: 150');
	});
});
