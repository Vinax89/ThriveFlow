import { type BNPLPlan, type Obligation } from './types';

export type Cadence = 'weekly'|'biweekly'|'monthly'|'quarterly'|'yearly'|'none';
export type UpcomingItem = {
  kind: 'bnpl' | 'obligation';
  id: string;
  label: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
};

const toDate = (s: string) => new Date(s + 'T00:00:00');
const toISO = (d: Date) => d.toISOString().slice(0,10);

function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
function addMonths(d: Date, months: number) { const x = new Date(d); x.setMonth(x.getMonth() + months); return x; }

// Split total across N installments, rounding to cents; last payment absorbs remainder.
export function bnplInstallments(plan: BNPLPlan): { amount: number; dates: string[] } {
  const cents = Math.round(plan.total * 100);
  const base = Math.floor(cents / plan.installments);
  const rem = cents - base * plan.installments;
  const amounts: number[] = Array.from({ length: plan.installments }, (_, i) => (i < plan.installments - 1 ? base : base + rem) / 100);
  const start = toDate(plan.startDate);
  const dates: string[] = [];
  for (let i = 0; i < plan.installments; i++) {
    let d = new Date(start);
    if (plan.cadence === 'weekly') d = addDays(start, 7 * i);
    else if (plan.cadence === 'biweekly') d = addDays(start, 14 * i);
    else d = addMonths(start, i); // monthly by default
    dates.push(toISO(d));
  }
  return { amount: Math.round((cents / plan.installments)) / 100, dates };
}

export function obligationNextDates(o: Obligation, horizonDays = 60): string[] {
  const start = o.nextDueDate ? toDate(o.nextDueDate) : new Date();
  const out: string[] = [];
  const end = addDays(new Date(), horizonDays);
  let d = new Date(start);
  const push = () => { if (d <= end) out.push(toISO(d)); };
  switch (o.cadence) {
    case 'weekly':
      while (d <= end) { push(); d = addDays(d, 7); }
      break;
    case 'biweekly':
      while (d <= end) { push(); d = addDays(d, 14); }
      break;
    case 'monthly':
      while (d <= end) { push(); d = addMonths(d, 1); }
      break;
    case 'quarterly':
      while (d <= end) { push(); d = addMonths(d, 3); }
      break;
    case 'yearly':
      while (d <= end) { push(); d = addMonths(d, 12); }
      break;
    default:
      if (o.nextDueDate) out.push(toISO(start));
  }
  return out;
}

export function upcomingPayments(plans: BNPLPlan[], obligations: Obligation[], horizonDays = 60): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const p of plans) {
    const { dates } = bnplInstallments(p);
    for (const date of dates) {
      const d = toDate(date);
      const today = new Date();
      today.setHours(0,0,0,0);
      const within = (d.getTime() - today.getTime()) / (1000*60*60*24) <= horizonDays && d >= today;
      if (within) items.push({ kind: 'bnpl', id: p.id, label: p.description || p.provider, amount: Math.round((p.total/p.installments)*100)/100, dueDate: date });
    }
  }
  for (const o of obligations) {
    for (const date of obligationNextDates(o, horizonDays)) {
      items.push({ kind: 'obligation', id: o.id, label: o.name, amount: o.amount, dueDate: date });
    }
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
