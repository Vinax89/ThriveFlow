'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  aggregateMonthly,
  topCategoriesForMonth,
  detectUnusualTransactions,
} from '@/lib/cashflow';
import type { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mock data - in a real app, this would be fetched from a database
const mockTransactions: Transaction[] = [
  // Last 6 months of transactions
  // Month -1
  { id: 't1', date: '2024-06-15', description: 'Salary', amount: 5000, category: 'Income', type: 'income' },
  { id: 't2', date: '2024-06-10', description: 'Groceries', amount: 200, category: 'Food', type: 'expense' },
  { id: 't3', date: '2024-06-20', description: 'Rent', amount: 1500, category: 'Housing', type: 'expense' },
  { id: 't4', date: '2024-06-25', description: 'Restaurant', amount: 80, category: 'Food', type: 'expense' },
  // Month -2
  { id: 't5', date: '2024-05-15', description: 'Salary', amount: 5000, category: 'Income', type: 'income' },
  { id: 't6', date: '2024-05-12', description: 'Groceries', amount: 220, category: 'Food', type: 'expense' },
  { id: 't7', date: '2024-05-20', description: 'Rent', amount: 1500, category: 'Housing', type: 'expense' },
  { id: 't8', date: '2024-05-28', description: 'Utilities', amount: 120, category: 'Utilities', type: 'expense' },
  // Month -3
  { id: 't9', date: '2024-04-15', description: 'Salary', amount: 5000, category: 'Income', type: 'income' },
  { id: 't10', date: '2024-04-09', description: 'Groceries', amount: 190, category: 'Food', type: 'expense' },
  { id: 't11', date: '2024-04-20', description: 'Rent', amount: 1500, category: 'Housing', type: 'expense' },
  { id: 't12', date: '2024-04-22', description: 'Car Insurance', amount: 150, category: 'Transport', type: 'expense' },
   // Unusual spend data point
  { id: 't13', date: '2024-04-25', description: 'New TV', amount: 1200, category: 'Entertainment', type: 'expense' },
  ...Array.from({length: 10}, (_, i) => ({ id: `e${i}`, date: `2024-03-${10+i}`, description: 'Misc', amount: 60, category: 'Entertainment', type: 'expense' as 'expense' })),

  // Month -4
  { id: 't14', date: '2024-03-15', description: 'Salary', amount: 4800, category: 'Income', type: 'income' },
  { id: 't15', date: '2024-03-11', description: 'Groceries', amount: 210, category: 'Food', type: 'expense' },
  // Month -5
  { id: 't16', date: '2024-02-15', description: 'Salary', amount: 4800, category: 'Income', type: 'income' },
  { id: 't17', date: '2024-02-14', description: 'Groceries', amount: 230, category: 'Food', type: 'expense' },
  // Month -6
  { id: 't18', date: '2024-01-15', description: 'Salary', amount: 4800, category: 'Income', type: 'income' },
  { id: 't19', date: '2024-01-18', description: 'Groceries', amount: 205, category: 'Food', type: 'expense' },
];


function lastMonths(n: number){
  const out: string[] = []; const d = new Date();
  for (let i=0;i<n;i++){ const x = new Date(d.getFullYear(), d.getMonth()-i, 1).toISOString().slice(0,7); out.push(x); }
  return out.reverse();
}

// Convert mock transactions to have negative amounts for expenses
const processedMockTransactions = mockTransactions.map(t => ({
  ...t,
  amount: t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount),
}));

export default function CashflowPage(){
  const [rows] = useState<any[]>(processedMockTransactions);
  const [months, setMonths] = useState(6);
  const monthsList = useMemo(() => lastMonths(months), [months]);
  const [focusMonth, setFocusMonth] = useState(monthsList.at(-1) || '');

  useEffect(() => {
    setFocusMonth(lastMonths(months).at(-1) || '');
  }, [months]);

  const monthly = useMemo(()=> aggregateMonthly(rows), [rows]);
  const categories = useMemo(()=> topCategoriesForMonth(rows, focusMonth || ''), [rows, focusMonth]);
  const anomalies = useMemo(()=> detectUnusualTransactions(rows, 90, 2.5, 50), [rows]);
  
  const filteredMonthly = useMemo(() => {
      const monthSet = new Set(monthsList);
      return monthly.filter(m => monthSet.has(m.month));
  }, [monthly, monthsList]);

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Cashflow Report
        </h1>
        <p className="text-muted-foreground">
          Analyze your income, expenses, and spending habits.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <div className="grid w-full sm:max-w-xs items-center gap-1.5">
          <Label htmlFor="months-input">Show Last (Months)</Label>
          <Input id="months-input" type="number" min={1} max={12} value={months} onChange={e=> setMonths(Number(e.target.value))} />
        </div>
         <div className="grid w-full sm:max-w-xs items-center gap-1.5">
          <Label>Focus Month</Label>
          <Select value={focusMonth} onValueChange={setFocusMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select a month" />
            </SelectTrigger>
            <SelectContent>
              {lastMonths(12).map(m=> <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
          <CardHeader>
              <CardTitle>Monthly Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
                <ResponsiveContainer>
                    <ComposedChart data={filteredMonthly}>
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--background))",
                            borderColor: "hsl(var(--border))",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="income" name="Income" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                        <Line dataKey="net" name="Net" type="monotone" stroke="hsl(var(--chart-1))" dot={false} strokeWidth={2} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
          </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Categories — {focusMonth}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(c=> (
                  <TableRow key={c.category}>
                    <TableCell className="font-medium">{c.category}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {`$${(-c.amount).toFixed(2)}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unusual Spend</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Z-Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map(a=> (
                  <TableRow key={a.id}>
                    <TableCell>{a.isoDate}</TableCell>
                    <TableCell className="font-medium">{a.merchant ?? '—'}</TableCell>
                    <TableCell className="text-right text-destructive">{`$${(-a.amount).toFixed(2)}`}</TableCell>
                    <TableCell className="text-right">{a.z.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {anomalies.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No unusual spending detected.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

    </main>
  );
}