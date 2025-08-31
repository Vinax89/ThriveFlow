import { type DebtAccount } from './types';
import { toCents, fromCents, clamp } from './money';

export type Strategy = 'snowball' | 'avalanche';
export type Payment = { id: string; month: string; principal: number; interest: number; balance: number };
export type Schedule = { timeline: Payment[]; totals: { months: number; interest: number } };

function orderIds(accts: DebtAccount[], strategy: Strategy): string[] {
  const items = accts.map(a => ({ id: a.id, bal: a.balance, apr: a.apr }));
  return items
    .sort((a, b) => (strategy === 'snowball' ? a.bal - b.bal : b.apr - a.apr))
    .map(x => x.id);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Deterministic monthly amortization with cents rounding:
 * 1) Interest accrues on starting balance for the month.
 * 2) Apply each account's minimum payment (up to balance+interest).
 * 3) Apply extra funds to the highest-priority remaining debt.
 * 4) Roll freed minimums automatically to next months via (2).
 */
export function getSchedule(
  accounts: DebtAccount[],
  strategy: Strategy,
  monthlyExtra = 0,
  startDate = new Date()
): Schedule {
  if (!accounts.length) return { timeline: [], totals: { months: 0, interest: 0 } };

  // Work in cents for deterministic rounding
  const state = new Map<string, { bal: number; apr: number; min: number }>();
  for (const a of accounts) {
    state.set(a.id, { bal: toCents(a.balance), apr: a.apr, min: toCents(a.minPayment) });
  }
  const extraCents = toCents(Math.max(0, monthlyExtra));
  const order = orderIds(accounts, strategy);

  const timeline: Payment[] = [];
  let totalInterest = 0;
  let month = 0;
  const MAX_MONTHS = 1200; // safety against infinite loops

  while (month < MAX_MONTHS) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + month, 1);
    const mKey = monthKey(date);

    let interestThisMonthTotal = 0;
    
    // Accrue interest and prepare for minimum payments
    for (const id of order) {
      const s = state.get(id)!;
      if (s.bal <= 0) continue;
      
      const monthlyRate = s.apr / 12 / 100;
      const interest = toCents(fromCents(s.bal) * monthlyRate);
      interestThisMonthTotal += interest;
      
      const due = s.bal + interest;
      const minPay = Math.min(s.min, due);
      
      const principalFromMin = clamp(minPay - interest);
      s.bal -= principalFromMin;
      
      timeline.push({ id, month: mKey, principal: fromCents(principalFromMin), interest: fromCents(interest), balance: fromCents(s.bal) });
    }
    
    totalInterest += interestThisMonthTotal;

    // Apply extra payment
    let surplus = extraCents;
    for (const id of order) {
      if (surplus <= 0) break;
      const s = state.get(id)!;
      if (s.bal <= 0) continue;
      
      const pay = Math.min(surplus, s.bal);
      s.bal -= pay;
      surplus -= pay;

      timeline.push({ id, month: mKey, principal: fromCents(pay), interest: 0, balance: fromCents(s.bal) });
    }
    
    const remaining = Array.from(state.values()).reduce((a, s) => a + s.bal, 0);
    if (remaining <= 0) break;
    
    month += 1;
  }

  // Consolidate monthly payments for cleaner view
  const consolidatedTimeline: Payment[] = [];
  const monthlyPayments = new Map<string, Map<string, {principal: number, interest: number, balance: number}>>();

  for(const p of timeline) {
    if(!monthlyPayments.has(p.month)) {
      monthlyPayments.set(p.month, new Map());
    }
    const monthMap = monthlyPayments.get(p.month)!;
    if(!monthMap.has(p.id)) {
      monthMap.set(p.id, {principal: 0, interest: 0, balance: 0});
    }
    const debtMonth = monthMap.get(p.id)!;
    debtMonth.principal += p.principal;
    debtMonth.interest += p.interest;
    debtMonth.balance = p.balance; // last balance is correct
  }
  
  const sortedMonths = Array.from(monthlyPayments.keys()).sort();

  for(const month of sortedMonths) {
    const monthMap = monthlyPayments.get(month)!;
    const sortedIds = Array.from(monthMap.keys()).sort((a,b) => order.indexOf(a) - order.indexOf(b));
    for(const id of sortedIds) {
      const p = monthMap.get(id)!;
      consolidatedTimeline.push({ id, month, ...p });
    }
  }


  return { timeline: consolidatedTimeline, totals: { months: month + 1, interest: fromCents(totalInterest) } };
}
