import type { Rule, Transaction } from './types';

const norm = (s?: string) => (s || '').toLowerCase();

export function matchRule(r: Rule, t: Transaction): boolean {
  if (!r.enabled) return false;
  const m = r.match;

  // Not supporting accountIds yet as it is not in the transaction type
  // if (m.accountIds.length && (!t.account_id || !m.accountIds.includes(t.account_id))) return false;
  
  if (m.minAmount != null && t.amount < m.minAmount) return false;
  if (m.maxAmount != null && t.amount > m.maxAmount) return false;

  if (m.merchantContains.length) {
    const mm = norm(t.description); // Using description as merchant
    const ok = m.merchantContains.some(s => mm.includes(norm(s)));
    if (!ok) return false;
  }
  if (m.categoryEquals.length) {
    const c = norm(t.category);
    const ok = m.categoryEquals.some(s => c === norm(s));
    if (!ok) return false;
  }
  return true;
}

export function applyRules(rules: Rule[], t: Transaction): string | undefined {
  const ordered = rules.filter(r => r.enabled).sort((a,b) => a.priority - b.priority);
  for (const r of ordered) {
    if (matchRule(r, t)) return r.action.nurseCategory;
  }
  return undefined;
}
