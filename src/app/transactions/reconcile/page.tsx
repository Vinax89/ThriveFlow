'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Reconcile(){
  const [uid, setUid] = useState<string|null>(null);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(()=> onAuthStateChanged(auth, u=> setUid(u?.uid ?? null)), []);
  useEffect(()=> { (async()=>{
    if (!uid) return;
    const start = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const s = await getDocs(query(collection(db,'transactions'), where('userId','==', uid), where('date','>=', start), orderBy('date','desc'), limit(5000)));
    const tx = s.docs.map(d => ({ id:d.id, ...(d.data() as any) }));
    // simple rule: show transactions without userCategory or with splits lacking category
    const needs = tx.filter(t => !t.userCategory || (t.splits?.some((x:any)=> !x.userCategory)));
    setRows(needs);
  })(); }, [uid]);
  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6">
       <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Reconcile Transactions
        </h1>
        <p className="text-muted-foreground">
         Transactions from the last 30 days that are missing categories or have incomplete splits.
        </p>
      </header>
       <Card>
        <CardHeader>
          <CardTitle>Needs Review</CardTitle>
          <CardDescription>
            {rows.length} transaction(s) need your attention.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                All caught up!
                            </TableCell>
                        </TableRow>
                    )}
                    {rows.map(r=> (
                        <TableRow key={r.id}>
                            <TableCell>{r.date}</TableCell>
                            <TableCell className="font-medium">{r.description || '—'}</TableCell>
                            <TableCell className="text-right font-mono">${r.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/review/transactions`}>Review</Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
       </Card>
    </main>
  );
}
