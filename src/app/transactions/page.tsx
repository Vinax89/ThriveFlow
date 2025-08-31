'use client';
import { useEffect, useState } from 'react';
import { listTransactions } from '@/app/actions/transactions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import SplitDialog from './SplitDialog';
import type { Transaction } from '@/lib/types';

export default function TransactionsPage(){
  const [uid] = useState('mock-user-id');
  const [rows, setRows] = useState<Transaction[]>([]);
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);

  async function fetchTransactions() {
      if(!uid) return;
      const { rows } = await listTransactions(uid, 500);
      setRows(rows as Transaction[]);
  }

  useEffect(()=> {
    fetchTransactions();
  }, [uid]);

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Transactions
            </h1>
            <p className="text-muted-foreground">
                View and manage your financial transactions.
            </p>
        </div>
        <Button asChild>
            <Link href="/transactions/import">Import CSV</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Showing the last 500 transactions.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((t:any)=> (
                <TableRow key={t.id}>
                    <TableCell>{t.date}</TableCell>
                    <TableCell className="font-medium">{t.description ?? ''}</TableCell>
                    <TableCell>
                        <Badge variant="outline">{t.category ?? 'Uncategorized'}</Badge>
                    </TableCell>
                    <td className={`p-4 text-right font-mono ${t.amount < 0 ?'text-destructive':'text-green-600'}`}>{t.amount.toFixed(2)}</td>
                    <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSplitTx(t)}>Split</Button>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </CardContent>
      </Card>
      {splitTx && (
        <SplitDialog 
            open={!!splitTx}
            onClose={() => { setSplitTx(null); fetchTransactions(); }}
            tx={splitTx}
        />
      )}
    </main>
  );
}
