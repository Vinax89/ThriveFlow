'use client';
import { useEffect, useState } from 'react';
import { parseCsv, mapRows, type CsvRow } from '@/lib/csv';
import { upsertTransactionsBulk } from '@/app/actions/transactions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';

export default function ImportPage(){
  const [uid] = useState('mock-user-id');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [map, setMap] = useState({ date: '', amount: '', merchant: '', notes: '', category: '' });
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  async function loadFile(file: File){
    try {
        const r = await parseCsv(file);
        if (r.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'CSV file is empty or invalid.' });
            return;
        }
        setRows(r);
        const newCols = Object.keys(r[0] ?? {});
        setCols(newCols);

        // Try auto-detect columns
        const lower = newCols.map(c => c.toLowerCase());
        const guess = (need: 'date'|'amount'|'merchant'|'notes'|'category') => {
        const patterns: Record<string, RegExp[]> = {
            date: [/date/, /posted/, /time/], 
            amount: [/amount/, /amt/, /value/], 
            merchant: [/merchant/, /name/, /description/], 
            notes: [/notes?/, /memo/], 
            category: [/category/, /type/]
        };
        const idx = lower.findIndex(k => patterns[need].some(rx => rx.test(k)));
        return idx >= 0 ? newCols[idx] : '';
        };
        setMap({ date: guess('date'), amount: guess('amount'), merchant: guess('merchant'), notes: guess('notes'), category: guess('category') });
        toast({ title: 'File loaded', description: `Previewing ${r.length} rows.`});
    } catch (error) {
        toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not parse the CSV file.'});
        console.error(error);
    }
  }

  async function doImport(){
    if (!uid) return;
    if (!map.date || !map.amount) {
        toast({ variant: 'destructive', title: 'Mapping incomplete', description: 'Date and Amount fields are required.'});
        return;
    }
    setImporting(true);
    toast({ title: 'Importing...', description: 'Please wait while we process your transactions.'});
    try {
        const txs = await mapRows(rows, map, uid);
        await upsertTransactionsBulk(txs);
        toast({ title: 'Success!', description: `Imported ${txs.length} transactions.`});
        setRows([]);
        setCols([]);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Import Failed', description: 'An error occurred during the import.'});
        console.error(error);
    } finally {
        setImporting(false);
    }
  }

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Import Transactions
        </h1>
        <p className="text-muted-foreground">
            Upload a CSV file to add your transactions.
        </p>
      </header>

      <Card>
        <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>Select a CSV file from your computer.</CardDescription>
        </CardHeader>
        <CardContent>
            <Input type="file" accept=".csv,text/csv" onChange={e=>{ const f=e.target.files?.[0]; if (f) loadFile(f); }} className="max-w-sm" />
        </CardContent>
      </Card>

      {cols.length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle>Map Columns</CardTitle>
                <CardDescription>Match the columns from your file to the required transaction fields.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(['date','amount','merchant','category','notes'] as const).map(k=> (
                    <div key={k} className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor={k} className="capitalize">{k} {k === 'date' || k === 'amount' ? '*' : ''}</Label>
                        <Select value={(map as any)[k]} onValueChange={value => setMap(m=> ({ ...m, [k]: value }))}>
                            <SelectTrigger id={k}>
                                <SelectValue placeholder="Select a column..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">(none)</SelectItem>
                                {cols.map(c=> <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </CardContent>
            <CardContent>
                 <Button disabled={!uid || importing || !map.date || !map.amount} onClick={doImport}>
                    {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {importing ? 'Importing...' : 'Import Transactions'}
                </Button>
            </CardContent>
        </Card>
      )}
    </main>
  );
}
