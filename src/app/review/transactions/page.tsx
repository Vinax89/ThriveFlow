'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '@/lib/types';
import { NURSE_CATEGORIES } from '@/lib/types';

// Mock data - in a real app, this would be fetched from a database
const mockTransactions: Transaction[] = [
  // Transactions that need review (missing userCategory)
  { id: '101', date: '2024-07-28', description: 'Cafeteria', amount: -12.50, category: 'Food and Drink', type: 'expense', aiCategory: 'meals_on_shift' },
  { id: '102', date: '2024-07-28', description: 'City Parking Garage', amount: -15.00, category: 'Services', type: 'expense', aiCategory: 'parking' },
  { id: '103', date: '2024-07-27', description: 'Scrub Depot', amount: -89.99, category: 'Shopping', type: 'expense', aiCategory: 'scrubs_uniforms' },
  { id: '104', date: '2024-07-26', description: 'Online CEU Course', amount: -49.00, category: 'Education', type: 'expense' }, // No AI category
  { id: '105', date: '2024-07-25', description: 'AMZ Mktp US', amount: -25.30, category: 'Shopping', type: 'expense', aiCategory: 'other' },
];


async function getUncategorizedTransactions(userId: string): Promise<Transaction[]> {
    console.log("Faking fetch for uncategorized tx for user:", userId);
    // In a real app, filter where userCategory is null/undefined
    return mockTransactions.filter(t => !t.userCategory);
}

async function setTransactionCategory(userId: string, transactionId: string, category: string): Promise<void> {
    console.log(`Faking update for tx ${transactionId} for user ${userId} to category ${category}`);
    const index = mockTransactions.findIndex(t => t.id === transactionId);
    if (index > -1) {
        mockTransactions[index].userCategory = category;
    }
}


export default function ReviewTransactionsPage() {
    const [uid] = useState('mock-user-id');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const { toast } = useToast();

    const fetchTransactions = async () => {
        if (!uid) return;
        const uncategorized = await getUncategorizedTransactions(uid);
        setTransactions(uncategorized);
    };

    useEffect(() => {
        fetchTransactions();
    }, [uid]);

    const handleCategoryUpdate = async (transactionId: string, newCategory: string) => {
        if (!uid) return;
        await setTransactionCategory(uid, transactionId, newCategory);
        toast({ title: 'Success', description: 'Transaction categorized.' });
        // Refresh the list
        fetchTransactions();
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Review Transactions
                </h1>
                <p className="text-muted-foreground">
                    Categorize transactions that couldn't be automatically handled by your rules.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Uncategorized Transactions</CardTitle>
                    <CardDescription>{transactions.length} transactions need your attention.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>AI Suggestion</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[250px]">Set Category</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        All caught up! No transactions to review.
                                    </TableCell>
                                </TableRow>
                            )}
                            {transactions.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell>{t.date}</TableCell>
                                    <TableCell className="font-medium">{t.description}</TableCell>
                                    <TableCell>
                                        {t.aiCategory ? <Badge variant="outline">{t.aiCategory}</Badge> : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="text-right">{`$${t.amount.toFixed(2)}`}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                        <Select onValueChange={(value) => handleCategoryUpdate(t.id, value)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Choose a category..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {NURSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {t.aiCategory && (
                                            <Button variant="secondary" size="sm" onClick={() => handleCategoryUpdate(t.id, t.aiCategory!)}>Accept AI</Button>
                                        )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
