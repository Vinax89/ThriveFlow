'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Pencil, Save, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { listObligations, upsertObligation, removeObligation } from '@/app/actions/obligations';
import type { Obligation } from '@/lib/types';

const emptyForm: Omit<Obligation, 'userId' | 'id'> = {
    name: '',
    amount: 0,
    cadence: 'monthly',
    nextDueDate: new Date().toISOString().slice(0, 10),
};

export default function ObligationsPage() {
    const [uid] = useState('mock-user-id');
    const [rows, setRows] = useState<Obligation[]>([]);
    const [editingObligation, setEditingObligation] = useState<Partial<Obligation> | null>(null);
    const { toast } = useToast();

    const fetchObligations = async () => {
        if (!uid) return;
        const userObligations = await listObligations(uid);
        setRows(userObligations);
    };

    useEffect(() => {
        fetchObligations();
    }, [uid]);

    const handleSave = async () => {
        if (!uid || !editingObligation) return;

        const obligationToSave: Obligation = {
            id: editingObligation.id || crypto.randomUUID(),
            userId: uid,
            name: editingObligation.name || '',
            amount: editingObligation.amount || 0,
            cadence: editingObligation.cadence || 'monthly',
            nextDueDate: editingObligation.nextDueDate || new Date().toISOString().slice(0, 10),
        };

        await upsertObligation(obligationToSave);
        await fetchObligations();
        setEditingObligation(null);
        toast({ title: 'Success', description: 'Obligation saved.' });
    };

    const handleRemove = async (obligationId: string) => {
        if (!uid) return;
        await removeObligation(obligationId);
        await fetchObligations();
        toast({ title: 'Success', description: 'Obligation removed.' });
    };

    const startNewObligation = () => {
        setEditingObligation(emptyForm);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Recurring Obligations
                    </h1>
                    <p className="text-muted-foreground">
                        Track your recurring bills and payments.
                    </p>
                </div>
                <Button onClick={startNewObligation}><PlusCircle className="mr-2" /> Add Obligation</Button>
            </header>

            {editingObligation && (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingObligation.id ? 'Edit Obligation' : 'New Obligation'}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={editingObligation.name}
                                onChange={e => setEditingObligation(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Amount</Label>
                            <Input
                                type="number"
                                value={editingObligation.amount}
                                onChange={e => setEditingObligation(f => ({ ...f, amount: Number(e.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Cadence</Label>
                            <Select value={editingObligation.cadence} onValueChange={val => setEditingObligation(f => ({ ...f, cadence: val as any }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                    <SelectItem value="none">None (One-time)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Next Due Date</Label>
                            <Input
                                type="date"
                                value={editingObligation.nextDueDate}
                                onChange={e => setEditingObligation(f => ({ ...f, nextDueDate: e.target.value }))}
                            />
                        </div>
                    </CardContent>
                    <CardContent className="flex gap-2">
                        <Button onClick={handleSave}><Save className="mr-2" /> Save</Button>
                        <Button variant="outline" onClick={() => setEditingObligation(null)}><XCircle className="mr-2" /> Cancel</Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Your Obligations</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Cadence</TableHead>
                                <TableHead>Next Due</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map(r => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-medium">{r.name}</TableCell>
                                    <TableCell className="text-right">${r.amount.toFixed(2)}</TableCell>
                                    <TableCell>{r.cadence}</TableCell>
                                    <TableCell>{r.nextDueDate}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingObligation(r)}><Pencil className="size-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemove(r.id)}><Trash2 className="size-4" /></Button>
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
