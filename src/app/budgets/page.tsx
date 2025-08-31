'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { projectEnvelopes, type Budget, type Envelope } from '@/lib/budget';
import { type Transaction } from '@/lib/types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// In a real app, this would come from a user-specific source or a comprehensive list
const NURSE_CATS = ['Scrubs/Uniforms','CEU/Licensure','Agency Fees','Housing Overage','Travel/Mileage','Travel/Lodging','Meals on Shift','Equipment/Supplies','Parking','Union Dues','Insurance','Utilities','Groceries','Transportation','Health','Entertainment','Income','Other'];

function ym(d = new Date()){ return d.toISOString().slice(0,7); }

// Mock data and functions - replace with actual API calls to your backend
const mockTransactions: Transaction[] = [
  { id: '1', date: `${ym()}-05`, amount: -120, category: 'Groceries', description: 'Supermart', type: 'expense' },
  { id: '2', date: `${ym()}-10`, amount: -45, category: 'Meals on Shift', description: 'Hospital Cafe', type: 'expense' },
  { id: '3', date: `${ym()}-15`, amount: 5000, category: 'Income', description: 'Paycheck', type: 'income' },
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
      { category: 'Groceries', planned: 500, carryover: false },
      { category: 'Meals on Shift', planned: 200, carryover: true },
      { category: 'Income', planned: 5000, carryover: false },
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

  function addEnvelope(){ setEnvelopes(e => [...e, { category: 'Groceries', planned: 0, carryover: false }]); }
  function removeEnvelope(i: number){ setEnvelopes(e => e.filter((_,idx)=> idx!==i)); }
  
  const handleEnvelopeChange = (index: number, field: keyof Envelope, value: any) => {
    setEnvelopes(currentEnvelopes =>
      currentEnvelopes.map((e, i) =>
        i === index ? { ...e, [field]: value } : e
      )
    );
  };

  const statuses = useMemo(()=> budget ? projectEnvelopes({ ...budget, envelopes } as Budget, txs) : [], [budget, envelopes, txs]);

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
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
           <Button onClick={addEnvelope}><PlusCircle className="mr-2" /> Add Envelope</Button>
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Projected</TableHead>
                    <TableHead className="text-center">Carryover</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
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
                            <Checkbox checked={e.carryover} onCheckedChange={checked => handleEnvelopeChange(i, 'carryover', checked)} />
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
