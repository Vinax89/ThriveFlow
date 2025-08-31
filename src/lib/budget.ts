import { Transaction, Budget, Envelope } from './types';

export function startOfMonth(month: string): string { return month + '-01'; }
export function endOfMonth(month: string): string {
  const [y,m] = month.split('-').map(Number);
  const d = new Date(y, m, 0); // last day of month
  return d.toISOString().slice(0,10);
}
export function daysInMonth(month: string): number {
  const [y,m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function sumByCategory(txs: Transaction[], month: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue;
    const cat = t.category || 'other';
    out[cat] = (out[cat] ?? 0) + t.amount; // expenses negative in our model
  }
  return out;
}

export type EnvelopeStatus = {
  category: string;
  planned: number;
  actual: number;      // sum of amounts (negative = spend, positive = income)
  projected: number;   // projection to month-end
  overrun: boolean;    // true if expense projection exceeds planned (for expense envelopes)
};

/**
 * Projection: linear rate based on days elapsed this month.
 * For expenses (negative actual), more negative is more spend.
 */
export function projectEnvelopes(b: Budget, txs: Transaction[], todayISO = new Date().toISOString().slice(0,10)): EnvelopeStatus[] {
  const month = b.month;
  const totals = sumByCategory(txs, month);
  const dim = daysInMonth(month);
  const day = todayISO.startsWith(month) ? Number(todayISO.slice(8,10)) : dim; // if outside month, assume end
  const elapsed = Math.max(1, Math.min(dim, day));

  const statuses: EnvelopeStatus[] = [];
  for (const e of b.envelopes) {
    const actual = totals[e.category] ?? 0;
    const rate = actual / elapsed; // per-day
    const projected = Math.round(rate * dim * 100) / 100;
    const isExpense = e.planned >= 0; // planned is positive budget amount; actual expenses are negative
    const overrun = isExpense ? (-projected) > e.planned : false;
    statuses.push({ category: e.category, planned: e.planned, actual, projected, overrun });
  }
  return statuses;
}
