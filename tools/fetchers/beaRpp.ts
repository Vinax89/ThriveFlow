import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import fetch from 'node-fetch';

// Note: You will need a BEA API key.
// https://apps.bea.gov/API/signup/
const API_KEY = process.env.BEA_API_KEY;
if (!API_KEY) {
  console.warn('BEA_API_KEY environment variable not set. Skipping RPP fetch.');
}

export async function fetchBeaRppOnce() {
  if (!API_KEY) return { bytes: 0, skipped: true };

  const res = await fetch(`https://apps.bea.gov/api/data/?UserID=${API_KEY}&method=GetData&datasetname=Regional&TableName=SARPP&LineCode=10&GeoFIPS=STATE&Year=ALL&ResultFormat=json`);
  if (!res.ok) throw new Error(`BEA fetch failed: ${res.status}`);
  
  const json = await res.json();
  const text = JSON.stringify(json, null, 2);

  // TODO: parse → normalize → map to our base.json shape
  await writeFile(join(process.cwd(), 'data/col/sources/bea-rpp-raw.json'), text, 'utf8');
  return { bytes: text.length };
}
