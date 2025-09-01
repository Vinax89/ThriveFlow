'use client';
import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { auth, db } from '@/lib/firebase-client';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { txFingerprint } from '@/lib/tx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const HINTS = ['date','posted','transaction date','posting date','amount','credit','debit','description','name','merchant','memo'];

type Row = Record<string, string>;

type Mapping = {
  date?: string; amount?: string; merchant?: string; memo?: string;
  creditSign?: 'positive'|'negative';         // if file has credit column only
  debitSign?: 'positive'|'negative';
  amountMode: 'single'|'debitcredit';         // single amount vs separate debit/credit
  expensesAre: 'negative'|'positive';         // for single amount files
  dateFormat?: string;                        // try auto, else provide e.g. MM/DD/YYYY
};

export default function ImportPage(){
  const [uid, setUid] = useState<string|undefined>();
  const [raw, setRaw] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Mapping>({ amountMode:'single', expensesAre:'negative' });
  const [preview, setPreview] = useState<any[]>([]);
  const [stats, setStats] = useState<{ candidate: number; duplicates: number }>({ candidate:0, duplicates:0 });

  useEffect(()=> onAuthStateChanged(auth, u=> setUid(u?.uid || undefined)), []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if (!f) return;
    Papa.parse<Row>(f, { header: true, skipEmptyLines: true, complete: (res)=> {
      const rows = res.data as Row[];
      setRaw(rows);
      const hdrs = Object.keys(rows[0] || {});
      setHeaders(hdrs);
      // naive auto-map by fuzzy include
      const synonyms: Record<string,string[]> = {
        date: ['date','posted','transaction date','posting date','date posted'],
        amount: ['amount','amt','transaction amount'],
        merchant: ['merchant','description','name','payee','narrative','details'],
        memo: ['memo','notes','note']
      };
      const auto = (hint: keyof typeof synonyms) => {
        const cand = synonyms[hint];
        return hdrs.find(h => cand.some(s => h.toLowerCase().includes(s)));
      }
      setMap(m => ({ ...m, date: auto('date') || m.date, amount: auto('amount') || m.amount, merchant: auto('merchant') || m.merchant, memo: auto('memo') || m.memo }));
    }});
  }

  function normDate(s?: string){ if (!s) return ''; const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().slice(0,10); return s; }
  function toAmount(r: Row){
    if (map.amountMode === 'debitcredit'){
      const debit = Number(String(r[map.debitSign==='positive'?'debit':'debit']).replace(/[^0-9.-]/g,''))||0;
      const credit = Number(String(r[map.creditSign==='positive'?'credit':'credit']).replace(/[^0-9.-]/g,''))||0;
      // debit positive = expense; credit positive = income
      return (credit>0? credit : 0) - (debit>0? debit:0);
    } else {
      const a = Number(String(r[map.amount!]).replace(/[^0-9.-]/g,''))||0;
      return map.expensesAre==='negative' ? a : -a; // convert to our convention
    }
  }

  async function buildPreview(){
    if (!uid) return;
    const rows = raw.slice(0, 200).map(r => {
      const isoDate = normDate(r[map.date!]);
      const merchant = String(r[map.merchant!]?.trim() || r[map.memo!]?.trim() || '');
      const amount = toAmount(r);
      const fingerprint = txFingerprint({ account_id: 'manual', date: isoDate, amount, description: merchant });
      return { isoDate, merchant, amount, fingerprint };
    }).filter(x => x.isoDate);

    // compute duplicate rate vs existing manual imports in same month
    const months = Array.from(new Set(rows.map(r => r.isoDate.slice(0,7))));
    const existing: Record<string, boolean> = {};
    for (const m of months){
      const s = await getDocs(query(collection(db,'transactions'), where('userId','==', uid), where('date','>=', m+'-01'), where('date','<=', m+'-31')));
      s.docs.forEach(d => { const t = d.data() as any; const f = txFingerprint({ account_id: t.account_id || 'manual', date: t.date, amount: t.amount, description: t.description }); existing[f] = true; });
    }
    const dup = rows.filter(r => existing[r.fingerprint]).length;
    setStats({ candidate: rows.length, duplicates: dup });
    setPreview(rows);
  }

  async function importAll(){
    if (!uid) return;
    const batch: any[] = [];
    for (const r of raw){
      const isoDate = normDate(r[map.date!]); if (!isoDate) continue;
      const merchant = String(r[map.merchant!]?.trim() || r[map.memo!]?.trim() || '');
      const amount = toAmount(r);
      const fingerprint = txFingerprint({ account_id: 'manual', date: isoDate, amount, description: merchant });
      batch.push({ date: isoDate, description: merchant, amount, currency:'USD', userId: uid, account_id:'manual', fingerprint, createdAt: new Date().toISOString() });
    }
    // fetch existing fingerprints for all months in batch
    const months = Array.from(new Set(batch.map(r => r.date.slice(0,7))));
    const existing: Record<string, boolean> = {};
    for (const m of months){
      const s = await getDocs(query(collection(db,'transactions'), where('userId','==', uid), where('date','>=', m+'-01'), where('date','<=', m+'-31')));
      s.docs.forEach(d => { const t = d.data() as any; const f = txFingerprint({ account_id: t.account_id || 'manual', date: t.date, amount: t.amount, description: t.description }); existing[f] = true; });
    }
    let written = 0; let skipped = 0;
    for (const t of batch){
      if (existing[t.fingerprint]) { skipped++; continue; }
      const id = crypto.randomUUID();
      await setDoc(doc(db,'transactions', id), { id, ...t });
      written++;
    }
    alert(`Imported ${written}, skipped ${skipped} duplicates.`);
  }

  const canPreview = useMemo(()=> !!(map.date && ((map.amountMode==='single' && map.amount) || map.amountMode==='debitcredit')), [map]);

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Import Transactions (CSV)</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>Select a CSV file to begin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="CSV file" className="max-w-sm" />
        </CardContent>
      </Card>
      
      {headers.length>0 && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>Match your file's columns to the required fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <CustomSelect label="Date" value={map.date} onChange={v=> setMap(m=> ({...m, date:v}))} headers={headers} />
              <CustomSelect label="Merchant/Description" value={map.merchant} onChange={v=> setMap(m=> ({...m, merchant:v}))} headers={headers} />
              <CustomSelect label="Memo (optional)" value={map.memo} onChange={v=> setMap(m=> ({...m, memo:v}))} headers={headers} allowEmpty />
              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">Amount Columns</legend>
                <RadioGroup defaultValue={map.amountMode} onValueChange={(v) => setMap(m=> ({...m, amountMode: v as any}))} className="mt-2">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="single" id="single" />
                        <Label htmlFor="single">Single amount column</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <RadioGroupItem value="debitcredit" id="debitcredit" />
                        <Label htmlFor="debitcredit">Separate debit/credit columns</Label>
                    </div>
                </RadioGroup>
                {map.amountMode==='single' ? (
                  <div className="mt-4 space-y-2">
                    <CustomSelect label="Amount" value={map.amount} onChange={v=> setMap(m=> ({...m, amount:v}))} headers={headers} />
                    <div className="flex items-center space-x-2 pl-2">
                        <Checkbox id="expensesPositive" checked={map.expensesAre==='positive'} onCheckedChange={c => setMap(m => ({...m, expensesAre: c ? 'positive' : 'negative'}))}/>
                        <Label htmlFor="expensesPositive" className="text-sm font-normal">My file lists expenses as positive numbers</Label>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <CustomSelect label="Debit Column" value={'debit'} onChange={()=>{}} headers={headers} />
                    <CustomSelect label="Credit Column" value={'credit'} onChange={()=>{}} headers={headers} />
                    <p className="col-span-2 text-xs text-muted-foreground">For this mode, please ensure your column headers are exactly "debit" and "credit".</p>
                  </div>
                )}
              </fieldset>
              <Button disabled={!canPreview} onClick={buildPreview}>Preview Import</Button>
          </CardContent>
        </Card>
      )}

      {preview.length>0 && (
        <Card>
            <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Found {stats.candidate} rows. {stats.duplicates > 0 && `Skipping ${stats.duplicates} potential duplicates.`}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto border rounded-md max-h-96">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Merchant</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Fingerprint</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {preview.slice(0,50).map((p,i)=> (
                        <TableRow key={i}>
                            <TableCell>{p.isoDate}</TableCell>
                            <TableCell>{p.merchant}</TableCell>
                            <TableCell className="text-right font-mono">{p.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">{p.fingerprint}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
                <Button className="mt-4" onClick={importAll}>Import {stats.candidate - stats.duplicates} Transactions</Button>
            </CardContent>
        </Card>
      )}
    </main>
  );
}

function CustomSelect({ label, value, onChange, headers, allowEmpty=false }:{ label:string; value?:string; onChange:(v:string)=>void; headers:string[]; allowEmpty?:boolean }){
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor={label}>{label}</Label>
        <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger id={label}>
                <SelectValue placeholder="Select a column..." />
            </SelectTrigger>
            <SelectContent>
                {allowEmpty && <SelectItem value="">(none)</SelectItem>}
                {headers.map(h=> <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
        </Select>
    </div>
  );
}
