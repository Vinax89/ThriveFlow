import { Transaction } from './types';

function norm(s?: string){ return (s || '').trim().toLowerCase().replace(/\s+/g,' '); }
export function txFingerprint(t: Pick<Transaction,'account_id'|'date'|'amount'|'description'>){
  // Round cents; allow for minor float wobbles
  const amt = Math.round((t.amount || 0) * 100);
  const date = (t.date || '').slice(0,10);
  const acc = t.account_id || 'manual';
  const merch = norm(t.description);
  return `${acc}|${date}|${amt}|${merch}`;
}

/**
 * Compute category totals for a month, respecting splits.
 * If splits exist, each split contributes to its category; otherwise use userCategory/category.
 */
export function totalsByCategorySplitAware(txs: Transaction[], month: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue;
    if (t.splits && t.splits.length) {
      for (const s of t.splits) {
        const cat = s.userCategory || s.category || 'other';
        out[cat] = (out[cat] ?? 0) + s.amount;
      }
    } else {
      const cat = t.userCategory || t.category || 'other';
      out[cat] = (out[cat] ?? 0) + t.amount;
    }
  }
  return out;
}
