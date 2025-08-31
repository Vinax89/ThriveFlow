import Papa from 'papaparse';

export type CsvRow = Record<string, string>;
export type CsvMap = { date: string; amount: string; merchant?: string; notes?: string; category?: string };

export function parseCsv(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, { header: true, skipEmptyLines: true, complete: r => resolve(r.data), error: reject });
  });
}

export async function sha256(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function mapRows(rows: CsvRow[], map: CsvMap, userId: string) {
  const out = [] as { id: string; userId: string; date: string; amount: number; type: 'income' | 'expense'; description: string; category?: string; createdAt: string }[];
  for (const r of rows) {
    const date = new Date(r[map.date]!).toISOString().slice(0,10);
    const amount = Number(String(r[map.amount]).replace(/[^0-9.-]/g, ''));
    const description = r[map.merchant ?? ''] || '';
    const category = r[map.category ?? ''] || undefined;
    const fingerprint = await sha256(`${userId}|${date}|${amount}|${description}|${category ?? ''}`);
    out.push({ id: fingerprint, userId, date, amount, type: amount > 0 ? 'income' : 'expense', description, category, createdAt: new Date().toISOString() });
  }
  return out;
}
