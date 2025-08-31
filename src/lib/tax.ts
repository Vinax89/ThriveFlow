import { z } from 'zod';

export const TaxBracket = z.object({ rate: z.number(), upTo: z.number().nullable() });
export const StateTaxTable = z.object({ state: z.string(), year: z.number(), brackets: z.array(TaxBracket) });
export type StateTaxTable = z.infer<typeof StateTaxTable>;

const modules: Record<string, () => Promise<any>> = {
  'CA_2025': () => import('./data/tax/CA_2025.json'),
  'TX_2025': () => import('./data/tax/TX_2025.json'),
};

export async function loadStateTax(state: string, year: number): Promise<StateTaxTable> {
  const key = `${state}_${year}`;
  const mod = modules[key] ? await modules[key]() : null;
  if (!mod) throw new Error(`No tax table for ${key}`);
  return StateTaxTable.parse(mod);
}

export function computeStateTax(table: StateTaxTable, taxableIncome: number) {
  let tax = 0;
  let remaining = taxableIncome;
  let previousBracketCap = 0;
  for (const b of table.brackets) {
    const cap = b.upTo ?? Infinity;
    const slice = Math.max(0, Math.min(remaining, cap - previousBracketCap));
    tax += slice * (b.rate / 100);
    remaining -= slice;
    previousBracketCap = cap;
    if (remaining <= 0) break;
  }
  return Math.max(0, Math.round(tax * 100) / 100);
}
