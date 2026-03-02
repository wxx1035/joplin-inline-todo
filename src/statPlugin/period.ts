import { DateRange, PeriodType } from './types';

function parseIsoDate(s?: string): Date | undefined {
	if (!s) return undefined;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
	const d = new Date(`${s}T00:00:00.000Z`);
	if (Number.isNaN(d.getTime())) return undefined;
	return d;
}

export function getDateRange(period: PeriodType, now = new Date(), from?: string, to?: string): DateRange {
	const year = now.getUTCFullYear();
	const month = now.getUTCMonth();

	if (period === 'all') return {};
	if (period === 'thisMonth') {
		return {
			from: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
			to: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
		};
	}
	if (period === 'lastMonth') {
		return {
			from: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
			to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
		};
	}
	if (period === 'thisYear') {
		return {
			from: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
			to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
		};
	}

	// custom
	return {
		from: parseIsoDate(from),
		to: parseIsoDate(to),
	};
}

export function inDateRange(dateIso: string, range: DateRange): boolean {
	const d = parseIsoDate(dateIso);
	if (!d) return false;
	if (range.from && d < range.from) return false;
	if (range.to && d > range.to) return false;
	return true;
}
