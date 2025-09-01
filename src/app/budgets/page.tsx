'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { projectEnvelopes, type Budget, type Envelope, rolloverFromPrevious } from '@/lib/budget';
import { type Transaction } from '@/lib/types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDoc, doc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Label } from '@/components/ui/label';

// In a real app, this would come from a user-specific source or a comprehensive list
const NURSE_CATS = ['Scrubs/Uniforms','CEU/Licensure','Agency Fees','Housing Overage','Travel/Mileage','Travel/Lodging','Meals on Shift','Equipment/Supplies','Parking','Union Dues','Insurance','Utilities','Groceries','Transportation','Health','Entertainment','Income','Other'];

function ym(d = new Date()){ return d.toISOString().slice(0,7); }

// Mock data and functions - replace with actual API calls to your backend
const mockTransactions: Transaction[] = [
  { id: '1', date: `${ym()}-05`, amount: -120, category: 'Groceries', description: 'Supermart', type: 'expense', userId: 'mock-user-id' },
  { id: '2', date: `${ym()}-10`, amount: -45, category: 'Meals on Shift', description: 'Hospital Cafe', type: 'expense', userId: 'mock-user-id' },
  { id: '3', date: `${ym()}-15`, amount: 5000, category: 'Income', description: 'Paycheck', type: 'income', userId: 'mock-user-id' },
];

async function getBudget(userId: string, month: string): Promise<Budget | null> {
  console.log(`Faking fetch for budget: ${userId}_${month}`);
  // Returning a default budget for demonstration if not found in mock storage
  const stored = localStorage.getItem(`budget_${userId}_${month}`);
  if (stored) return JSON.parse(stored);
  return {
    id: `${userId}_${month}`,
    userId,
    month,
    locked: false,
    envelopes: [
      { category: 'Groceries', planned: 500, carryover: false, openingBalance: 0, allowNegative: false },
      { category: 'Meals on Shift', planned: 200, carryover: true, openingBalance: 0, allowNegative: false },
      { category: 'Income', planned: 5000, carryover: false, openingBalance: 0, allowNegative: false },
    ],
  };
}

async function upsertBudget(b: Budget) {
  console.log("Saving budget", b);
  localStorage.setItem(`budget_${b.id}`, JSON.stringify(b));
}

async function getTransactions(userId: string, month: string): Promise<Transaction[]> {
    console.log(`Faking fetch for transactions in month: ${month} for user ${userId}`);
    return mockTransactions.filter(t => t.date.startsWith(month));
}


export default function BudgetsPage(){
  const [uid] = useState<string | null>('mock-user-id'); // Using mock user ID
  const [month, setMonth] = useState(ym());
  const [budget, setBudget] = useState<Budget | null>(null);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'linear'|'ewma'>('linear');
  const [alpha, setAlpha] = useState(0.35);
  const { toast } = useToast();

  useEffect(()=> {
    if (!uid) return;
    setIsLoading(true);
    Promise.all([
        getBudget(uid, month),
        getTransactions(uid, month)
    ]).then(([b, transactions]) => {
        if (b) {
            setBudget(b);
            setEnvelopes(b.envelopes);
        } else {
            const newBudget = { id: `${uid}_${month}`, userId: uid, month, locked:false, envelopes: [] };
            setBudget(newBudget);
            setEnvelopes([]);
        }
        setTxs(transactions);
        setIsLoading(false);
    });
  }, [uid, month]);

  async function save(){
    if (!budget) return;
    await upsertBudget({ ...budget, envelopes });
    toast({ title: 'Success', description: 'Budget saved successfully.' });
  }

  function addEnvelope(){ setEnvelopes(e => [...e, { category: 'Groceries', planned: 0, carryover: false, openingBalance: 0, allowNegative: false }]); }
  function removeEnvelope(i: number){ setEnvelopes(e => e.filter((_,idx)=> idx!==i)); }
  
  const handleEnvelopeChange = (index: number, field: keyof Envelope, value: any) => {
    setEnvelopes(currentEnvelopes =>
      currentEnvelopes.map((e, i) =>
        i === index ? { ...e, [field]: value } : e
      )
    );
  };

  const statuses = useMemo(()=> budget ? projectEnvelopes({ ...budget, envelopes } as Budget, txs, undefined, mode, alpha) : [], [budget, envelopes, txs, mode, alpha]);

  async function rollover(){
    if (!uid) return;
    const [y,m] = month.split('-').map(Number);
    const prevM = new Date(y, m-2, 1).toISOString().slice(0,7);
    // fetch prev budget + txs
    const prevId = `${uid}_${prevM}`;
    const prevSnap = await getDoc(doc(db,'budgets', prevId));
    if (!prevSnap.exists()) { alert('No previous budget'); return; }
    const prevB = prevSnap.data() as any;
    const prevTx = await getDocs(query(collection(db,'transactions'), where('userId','==', uid), where('date','>=', prevM+'-01'), where('date','<=', prevM+'-31')));
    const next = rolloverFromPrevious(prevB, { ...budget, envelopes } as any, prevTx.docs.map(d=> d.data() as any));
    setEnvelopes(next.envelopes as any);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
       <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Monthly Budget
        </h1>
        <p className="text-muted-foreground">
          Manage your envelopes for {month}.
        </p>
      </header>

      <Card>
        <CardHeader>
             <div className="flex items-center gap-4">
                <Input type="month" className="w-48" value={month} onChange={e=> setMonth(e.target.value)} />
                 <div className="flex items-center gap-2">
                    <Label>Projection</Label>
                    <Select value={mode} onValueChange={e=> setMode(e as any)}>
                      <SelectTrigger className='w-32'><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linear">Linear</SelectItem>
                        <SelectItem value="ewma">EWMA</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                {mode==='ewma' && (
                  <div className="flex items-center gap-2">
                    <Label>Alpha</Label>
                    <Input className="w-24" type="number" min={0.05} max={0.9} step={0.05} value={alpha} onChange={e=> setAlpha(Number(e.target.value))} />
                  </div>
                )}
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className='flex gap-2'>
            <Button onClick={addEnvelope}><PlusCircle className="mr-2" /> Add Envelope</Button>
            <Button onClick={rollover} variant="outline">Roll over from previous month</Button>
           </div>
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Projected</TableHead>
                    <TableHead className="text-center">Carryover</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
                ) : envelopes.map((e, i) => {
                    const s = statuses.find(x => x.category === e.category);
                    return (
                    <TableRow key={i}>
                        <TableCell>
                            <Select value={e.category} onValueChange={value => handleEnvelopeChange(i, 'category', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {NURSE_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell className="text-right">{(e.openingBalance ?? 0).toFixed(2)}</TableCell>
                        <TableCell>
                            <Input className="w-28 text-right ml-auto" type="number" value={e.planned} onChange={ev => handleEnvelopeChange(i, 'planned', Number(ev.target.value))} />
                        </TableCell>
                        <TableCell className={`text-right ${s && s.actual < 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {s ? `$${s.actual.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className={`text-right ${s?.overrun ? 'text-red-500 font-bold' : ''}`}>
                            {s ? `$${s.projected.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                            <div className='flex flex-col items-center gap-1'>
                              <Checkbox checked={e.carryover} onCheckedChange={checked => handleEnvelopeChange(i, 'carryover', Boolean(checked))} />
                              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={e.allowNegative ?? false} onChange={ev=> handleEnvelopeChange(i, 'allowNegative', ev.target.checked)} /> allow (-)</label>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={()=> removeEnvelope(i)}><Trash2 className="size-4 text-muted-foreground" /></Button>
                        </TableCell>
                    </TableRow>
                    );
                })}
                </TableBody>
                </Table>
            </div>
            <Button onClick={save}>Save Budget</Button>
        </CardContent>
      </Card>
    </div>
  );
}
