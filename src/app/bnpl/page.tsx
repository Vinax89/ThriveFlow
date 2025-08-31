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
import { listBNPL, upsertBNPL, removeBNPL } from '@/app/actions/bnpl';
import type { BNPLPlan } from '@/lib/types';

const emptyForm: Omit<BNPLPlan, 'userId' | 'id'> = {
    provider: '',
    description: '',
    total: 0,
    installments: 4,
    startDate: new Date().toISOString().slice(0, 10),
    cadence: 'monthly'
};

export default function BNPLPage() {
    const [uid] = useState('mock-user-id');
    const [rows, setRows] = useState<BNPLPlan[]>([]);
    const [editingPlan, setEditingPlan] = useState<Partial<BNPLPlan> | null>(null);
    const { toast } = useToast();

    const fetchPlans = async () => {
        if (!uid) return;
        const userPlans = await listBNPL(uid);
        setRows(userPlans);
    };

    useEffect(() => {
        fetchPlans();
    }, [uid]);

    const handleSave = async () => {
        if (!uid || !editingPlan) return;

        const planToSave: BNPLPlan = {
            id: editingPlan.id || crypto.randomUUID(),
            userId: uid,
            provider: editingPlan.provider || '',
            description: editingPlan.description || '',
            total: editingPlan.total || 0,
            installments: editingPlan.installments || 4,
            startDate: editingPlan.startDate || new Date().toISOString().slice(0, 10),
            cadence: editingPlan.cadence || 'monthly',
        };

        await upsertBNPL(planToSave);
        await fetchPlans();
        setEditingPlan(null);
        toast({ title: 'Success', description: 'BNPL plan saved.' });
    };

    const handleRemove = async (planId: string) => {
        if (!uid) return;
        await removeBNPL(planId);
        await fetchPlans();
        toast({ title: 'Success', description: 'BNPL plan removed.' });
    };

    const startNewPlan = () => {
        setEditingPlan(emptyForm);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Buy Now, Pay Later Plans
                    </h1>
                    <p className="text-muted-foreground">
                        Track your installment plans.
                    </p>
                </div>
                <Button onClick={startNewPlan}><PlusCircle className="mr-2" /> Add Plan</Button>
            </header>

            {editingPlan && (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingPlan.id ? 'Edit Plan' : 'New Plan'}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Provider</Label>
                            <Input
                                value={editingPlan.provider}
                                onChange={e => setEditingPlan(f => ({ ...f, provider: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={editingPlan.description}
                                onChange={e => setEditingPlan(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Total Amount</Label>
                            <Input
                                type="number"
                                value={editingPlan.total}
                                onChange={e => setEditingPlan(f => ({ ...f, total: Number(e.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Installments</Label>
                            <Input
                                type="number"
                                value={editingPlan.installments}
                                onChange={e => setEditingPlan(f => ({ ...f, installments: Number(e.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                                type="date"
                                value={editingPlan.startDate}
                                onChange={e => setEditingPlan(f => ({ ...f, startDate: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Cadence</Label>
                            <Select value={editingPlan.cadence} onValueChange={val => setEditingPlan(f => ({ ...f, cadence: val as any }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                    <CardContent className="flex gap-2">
                        <Button onClick={handleSave}><Save className="mr-2" /> Save</Button>
                        <Button variant="outline" onClick={() => setEditingPlan(null)}><XCircle className="mr-2" /> Cancel</Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Your Plans</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Provider</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Cadence</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map(r => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-medium">{r.provider}</TableCell>
                                    <TableCell>{r.description}</TableCell>
                                    <TableCell className="text-right">${r.total.toFixed(2)} ({r.installments}x)</TableCell>
                                    <TableCell>{r.cadence}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingPlan(r)}><Pencil className="size-4" /></Button>
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
