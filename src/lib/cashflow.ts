import type { Transaction } from './types';

export type MonthlyRow = { month: string; income: number; expenses: number; net: number };
export type CatTotal = { category: string; amount: number };
export type Anomaly = { id: string; isoDate: string; merchant?: string; category?: string; amount: number; z: number };

export const yyyymm = (iso: string) => iso.slice(0,7);

export function aggregateMonthly(txs: Transaction[]): MonthlyRow[] {
  const m = new Map<string, { income: number; expenses: number }>();
  for (const t of txs) {
    const k = yyyymm(t.date);
    const row = m.get(k) || { income: 0, expenses: 0 };
    if (t.amount >= 0) row.income += t.amount; else row.expenses += t.amount; // expenses negative
    m.set(k, row);
  }
  return Array.from(m.entries())
    .map(([month, { income, expenses }]) => ({ month, income, expenses, net: income + expenses }))
    .sort((a,b) => a.month.localeCompare(b.month));
}

export function topCategoriesForMonth(txs: Transaction[], month: string, topN = 6): CatTotal[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue;
    const cat = t.category || 'other';
    if (t.amount < 0) map.set(cat, (map.get(cat) || 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a,b) => a.amount - b.amount) // most negative first
    .slice(0, topN);
}

function mean(arr: number[]) { return arr.reduce((a,b)=>a+b,0) / (arr.length || 1); }
function stddev(arr: number[]) { const mu = mean(arr); const v = mean(arr.map(x => (x-mu)**2)); return Math.sqrt(v); }

/**
 * Unusual spend detection:
 *  - For each tx, compute z-score against absolute amounts of prior 90 days in same category.
 *  - Only flag if |amount| >= minAbs and z >= zCutoff.
 */
export function detectUnusualTransactions(
  txs: Transaction[],
  lookbackDays = 90,
  zCutoff = 2.5,
  minAbs = 50
): Anomaly[] {
  // sort by date asc for rolling window
  const rows = [...txs].sort((a,b) => a.date.localeCompare(b.date));
  const byCat = new Map<string, { isoDate: string; amountAbs: number; id: string; merchant?: string; category?: string }[]>();
  for (const t of rows) {
    const cat = (t.category || 'other').toLowerCase();
    const amountAbs = Math.abs(t.amount);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push({ isoDate: t.date, amountAbs, id: t.id, merchant: t.description, category: cat });
  }
  const anomalies: Anomaly[] = [];
  for (const [cat, arr] of byCat.entries()) {
    for (let i = 0; i < arr.length; i++) {
      const cur = arr[i];
      // build lookback window
      const curDate = new Date(cur.isoDate + 'T00:00:00Z');
      const win: number[] = [];
      for (let j = Math.max(0, i-120); j < i; j++) {
        const prev = new Date(arr[j].isoDate + 'T00:00:00Z');
        const diffDays = (curDate.getTime() - prev.getTime()) / 86400000;
        if (diffDays > 0 && diffDays <= lookbackDays) win.push(arr[j].amountAbs);
      }
      if (win.length < 6) continue; // need enough history
      const mu = mean(win), sd = stddev(win) || 1e-9;
      const z = (cur.amountAbs - mu) / sd;
      if (cur.amountAbs >= minAbs && z >= zCutoff) {
        anomalies.push({ id: cur.id, isoDate: cur.isoDate, merchant: cur.merchant, category: cat, amount: rows.find(t=>t.id===cur.id)!.amount, z: Math.round(z*100)/100 });
      }
    }
  }
  // sort highest z first desc
  return anomalies.sort((a,b) => b.z - a.z);
}