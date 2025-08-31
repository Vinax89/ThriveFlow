'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listDebts } from '@/app/actions/debts';
import { getSchedule, type Strategy, type DebtAccount } from '@/lib/debt';

export default function SchedulePage() {
    const [uid] = useState('mock-user-id');
    const [extra, setExtra] = useState(0);
    const [strategy, setStrategy] = useState<Strategy>('snowball');
    const [debts, setDebts] = useState<DebtAccount[]>([]);

    useEffect(() => {
        if (!uid) return;
        listDebts(uid).then(setDebts);
    }, [uid]);

    const schedule = useMemo(() => getSchedule(debts, strategy, extra), [debts, strategy, extra]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Debt Payoff Schedule
                </h1>
                <p className="text-muted-foreground">
                    Plan your path to becoming debt-free.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Payoff Strategy</CardTitle>
                    <CardDescription>
                        Choose a strategy and add extra payments to see how it affects your timeline.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Strategy</Label>
                        <Select value={strategy} onValueChange={value => setStrategy(value as Strategy)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="snowball">Snowball (Lowest Balance First)</SelectItem>
                                <SelectItem value="avalanche">Avalanche (Highest APR First)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Extra Payment Per Month</Label>
                        <Input type="number" value={extra} onChange={e => setExtra(Number(e.target.value))} />
                    </div>
                </CardContent>
                 <CardContent>
                    <div className="text-lg">
                        <span>Months to payoff: </span><span className="font-bold text-primary">{schedule.totals.months}</span>
                        <span className="mx-4">|</span>
                        <span>Total interest: </span><span className="font-bold text-primary">${schedule.totals.interest.toFixed(2)}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>Amortization Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead>Debt</TableHead>
                                <TableHead className="text-right">Principal</TableHead>
                                <TableHead className="text-right">Interest</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schedule.timeline.map((p, i) => (
                                <TableRow key={i}>
                                    <TableCell>{p.month}</TableCell>
                                    <TableCell>{debts.find(d => d.id === p.id)?.name}</TableCell>
                                    <TableCell className="text-right">${p.principal.toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-destructive">${p.interest.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-medium">${p.balance.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
