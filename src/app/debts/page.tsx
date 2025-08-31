'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Pencil, Save, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { listDebts, upsertDebt, removeDebt } from '@/app/actions/debts';
import type { DebtAccount } from '@/lib/types';
import Link from 'next/link';

const emptyForm: Omit<DebtAccount, 'userId' | 'id'> = {
    name: '',
    balance: 0,
    apr: 0,
    minPayment: 0,
};

export default function DebtsPage() {
    const [uid] = useState('mock-user-id');
    const [debts, setDebts] = useState<DebtAccount[]>([]);
    const [editingDebt, setEditingDebt] = useState<Partial<DebtAccount> | null>(null);
    const { toast } = useToast();

    const fetchDebts = async () => {
        if (!uid) return;
        const userDebts = await listDebts(uid);
        setDebts(userDebts);
    };

    useEffect(() => {
        fetchDebts();
    }, [uid]);

    const handleSave = async () => {
        if (!uid || !editingDebt) return;

        const debtToSave: DebtAccount = {
            id: editingDebt.id || crypto.randomUUID(),
            userId: uid,
            name: editingDebt.name || '',
            balance: editingDebt.balance || 0,
            apr: editingDebt.apr || 0,
            minPayment: editingDebt.minPayment || 0,
        };

        await upsertDebt(debtToSave);
        await fetchDebts();
        setEditingDebt(null);
        toast({ title: 'Success', description: 'Debt account saved.' });
    };

    const handleRemove = async (debtId: string) => {
        if (!uid) return;
        await removeDebt(debtId);
        await fetchDebts();
        toast({ title: 'Success', description: 'Debt account removed.' });
    }

    const startNewDebt = () => {
        setEditingDebt(emptyForm);
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Debt Accounts
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your loans and credit cards.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={startNewDebt}><PlusCircle className="mr-2" /> Add Debt</Button>
                    <Button variant="secondary" asChild>
                        <Link href="/debts/schedule">View Payoff Schedule</Link>
                    </Button>
                </div>
            </header>

            {editingDebt && (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingDebt.id ? 'Edit Debt' : 'New Debt'}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={editingDebt.name}
                                onChange={e => setEditingDebt(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Balance</Label>
                            <Input
                                type="number"
                                value={editingDebt.balance}
                                onChange={e => setEditingDebt(f => ({ ...f, balance: Number(e.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>APR %</Label>
                            <Input
                                type="number"
                                value={editingDebt.apr}
                                onChange={e => setEditingDebt(f => ({ ...f, apr: Number(e.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Minimum Payment</Label>
                            <Input
                                type="number"
                                value={editingDebt.minPayment}
                                onChange={e => setEditingDebt(f => ({ ...f, minPayment: Number(e.target.value) }))}
                            />
                        </div>
                    </CardContent>
                    <CardContent className="flex gap-2">
                        <Button onClick={handleSave}><Save className="mr-2" /> Save</Button>
                        <Button variant="outline" onClick={() => setEditingDebt(null)}><XCircle className="mr-2" /> Cancel</Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Your Debt Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">APR</TableHead>
                                <TableHead className="text-right">Min. Payment</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {debts.map(d => (
                                <TableRow key={d.id}>
                                    <TableCell className="font-medium">{d.name}</TableCell>
                                    <TableCell className="text-right">${d.balance.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{d.apr.toFixed(2)}%</TableCell>
                                    <TableCell className="text-right">${d.minPayment.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingDebt(d)}><Pencil className="size-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemove(d.id)}><Trash2 className="size-4" /></Button>
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
