import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import fetch from 'node-fetch';

export async function fetchBlsCpiOnce() {
  const res = await fetch('https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems'); // example feed
  if (!res.ok) throw new Error(`BLS fetch failed: ${res.status}`);
  const text = await res.text();
  // TODO: parse → normalize → map to our base.json shape
  await writeFile(join(process.cwd(), 'data/col/sources/bls-raw.txt'), text, 'utf8');
  return { bytes: text.length };
}
