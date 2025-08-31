import { Transaction } from './types';

export function yyyymm(date: string) {
  return date.slice(0, 7); // YYYY-MM
}

export function rangeDays(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function dailyTotals(txs: Transaction[], days = 180) {
  const keys = new Set(rangeDays(days));
  const map = new Map<string, number>();
  for (const k of keys) map.set(k, 0);
  for (const t of txs) if (map.has(t.date)) map.set(t.date, (map.get(t.date) || 0) + t.amount);
  return Array.from(map.entries()).map(([date, amount]) => ({ date, amount }));
}

export function monthlyTotals(txs: Transaction[]) {
  const map = new Map<string, number>();
  for (const t of txs) {
    const m = yyyymm(t.date);
    map.set(m, (map.get(m) || 0) + t.amount);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({ month, amount }));
}
