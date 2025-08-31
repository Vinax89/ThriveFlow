'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listBNPL } from '@/app/actions/bnpl';
import { listObligations } from '@/app/actions/obligations';
import { upcomingPayments } from '@/lib/payments';
import type { BNPLPlan, Obligation } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function UpcomingPage() {
    const [uid] = useState('mock-user-id');
    const [horizon, setHorizon] = useState(60);
    const [bnpl, setBnpl] = useState<BNPLPlan[]>([]);
    const [obs, setObs] = useState<Obligation[]>([]);

    useEffect(() => {
        if (!uid) return;
        listBNPL(uid).then(setBnpl);
        listObligations(uid).then(setObs);
    }, [uid]);

    const items = useMemo(() => upcomingPayments(bnpl, obs, horizon), [bnpl, obs, horizon]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Upcoming Payments
                </h1>
                <p className="text-muted-foreground">
                    A forecast of your upcoming bills and installments.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <div className="grid w-full max-w-xs items-center gap-1.5">
                        <Label htmlFor="horizon-days">Horizon (days)</Label>
                        <Input
                            id="horizon-days"
                            type="number"
                            value={horizon}
                            onChange={e => setHorizon(Number(e.target.value))}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Label</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((x, i) => (
                                <TableRow key={i}>
                                    <TableCell>{x.dueDate}</TableCell>
                                    <TableCell>
                                        <Badge variant={x.kind === 'bnpl' ? 'secondary' : 'outline'}>{x.kind.toUpperCase()}</Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{x.label}</TableCell>
                                    <TableCell className="text-right font-mono">${x.amount.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                             {items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No upcoming payments in the selected horizon.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
