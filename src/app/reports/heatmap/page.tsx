'use client';
import { useEffect, useMemo, useState } from 'react';
import { listTransactions } from '@/app/actions/transactions';
import { dailyTotals, monthlyTotals } from '@/lib/reports';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function HeatmapPage(){
  const [uid] = useState('mock-user-id');
  const [rows, setRows] = useState<any[]>([]);
  const [days, setDays] = useState(180);
  
  useEffect(()=> {
    if(!uid) return;
    listTransactions(uid, 2000).then(r=> setRows(r.rows));
  }, [uid]);

  const daily = useMemo(()=> dailyTotals(rows, days), [rows, days]);
  const monthly = useMemo(()=> monthlyTotals(rows), [rows]);
  const maxAbs = useMemo(()=> Math.max(...daily.map(d=> Math.abs(d.amount)), 1), [daily]);

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Spending Heatmap
        </h1>
        <p className="text-muted-foreground">
          Visualize your daily spending habits and monthly totals.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Daily Spending Over {days} Days</CardTitle>
          <CardDescription>Each square represents a day. Darker shades indicate higher spending.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full max-w-xs items-center gap-1.5 mb-6">
            <Label htmlFor="days-input">Days to Show</Label>
            <Input id="days-input" type="number" value={days} onChange={e=> setDays(Number(e.target.value))} />
          </div>
          
          <div className="grid grid-cols-30 gap-1 p-2 border rounded-md bg-muted/20">
            {daily.map((d,i)=> {
              const v = d.amount; // negative is spend
              const intensity = Math.min(1, Math.abs(v) / maxAbs);
              const bg = v < 0 ? `rgba(220, 38, 38, ${0.15 + 0.85*intensity})` : `rgba(22, 163, 74, ${0.15 + 0.85*intensity})`;
              return <div key={i} title={`${d.date}: ${v.toFixed(2)}`} style={{ background: bg, width: 12, height: 12 }} className="rounded-sm" />;
            })}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Monthly Totals</CardTitle>
            <CardDescription>Net income/expense for each month.</CardDescription>
        </CardHeader>
        <CardContent>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                <BarChart data={monthly}>
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
        </CardContent>
      </Card>
    </main>
  );
}
