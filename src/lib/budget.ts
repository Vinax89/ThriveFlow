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
    const cat = t.userCategory || t.category || 'other';
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

export type ProjectionMode = 'linear' | 'ewma';

/**
 * Projection: linear rate based on days elapsed this month.
 * For expenses (negative actual), more negative is more spend.
 */
export function projectEnvelopes(
  b: Budget, 
  txs: Transaction[], 
  todayISO = new Date().toISOString().slice(0,10),
  mode: ProjectionMode = 'linear',
  alpha = 0.35 // EWMA smoothing factor
): EnvelopeStatus[] {
  const month = b.month;
  const totals = sumByCategory(txs, month);
  const dim = daysInMonth(month);
  const day = todayISO.startsWith(month) ? Number(todayISO.slice(8,10)) : dim; // if outside month, assume end
  const elapsed = Math.max(1, Math.min(dim, day));

  const daily: Record<string, number[]> = {};
  // Build daily series (expenses negative)
  for (const e of b.envelopes) daily[e.category] = Array.from({ length: day }, () => 0);
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue;
    const cat = t.userCategory || t.category || 'other';
    if(!daily[cat]) continue;
    const d = Number(t.date.slice(8,10));
    daily[cat][d-1] += t.amount;
  }

  function ewma(arr: number[], a: number) {
    let s = 0; const out: number[] = [];
    for (let i=0;i<arr.length;i++) { s = a*arr[i] + (1-a)*s; out.push(s); }
    return out;
  }

  const statuses: EnvelopeStatus[] = [];
  for (const e of b.envelopes) {
    const actual = totals[e.category] ?? 0;
    let projected = 0;
    if (mode === 'linear') {
      const rate = actual / elapsed; // per-day
      projected = Math.round(rate * dim * 100) / 100;
    } else {
        const s = ewma(daily[e.category] || [], alpha);
        const last = s.at(-1) ?? 0; // current daily EWMA
        projected = last * dim; // extend to month end
        // Anchor to current actual so we don't underflow/overflow wildly
        if ((actual < 0 && projected > actual) || (actual >= 0 && projected < actual)) projected = actual;
    }
    
    const opening = e.openingBalance ?? 0;
    const isExpense = e.planned >= 0; // planned is positive budget amount; actual expenses are negative
    const overrun = isExpense ? (-(projected)) > (e.planned + opening) : false;
    statuses.push({ category: e.category, planned: e.planned, actual, projected, overrun });
  }
  return statuses;
}

export function rolloverFromPrevious(prev: Budget, curr: Budget, txsPrev: Transaction[]) {
  const totals = sumByCategory(txsPrev, prev.month);
  const mapPrev = new Map(prev.envelopes.map(e => [e.category, e]));
  const nextEnvelopes = curr.envelopes.map(e => {
    const p = mapPrev.get(e.category);
    if (!p || !p.carryover) return e;
    const spentPos = Math.max(0, -(totals[e.category] ?? 0)); // convert to +
    const left = (p.planned + (p.openingBalance ?? 0)) - spentPos; // may be negative
    if (left < 0 && !p.allowNegative) return { ...e, openingBalance: 0 };
    return { ...e, openingBalance: left };
  });
  return { ...curr, envelopes: nextEnvelopes } as Budget;
}
