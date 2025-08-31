'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Account, Institution } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

// Mock data
const mockInstitutions: Institution[] = [
    { id: 'item_123', userId: 'mock-user-id', status: 'good', lastSyncAt: new Date().toISOString() },
    { id: 'item_456', userId: 'mock-user-id', status: 'good', lastSyncAt: new Date(Date.now() - 86400000).toISOString() },
];

const mockAccounts: Account[] = [
    { id: 'acc_1', userId: 'mock-user-id', itemId: 'item_123', name: 'Chase Checking', officialName: 'Chase Total Checking', mask: '0000', type: 'depository', subtype: 'checking', currency: 'USD', currentBalance: 4215.32, availableBalance: 4100.12 },
    { id: 'acc_2', userId: 'mock-user-id', itemId: 'item_123', name: 'Chase Savings', officialName: 'Chase Premier Savings', mask: '1111', type: 'depository', subtype: 'savings', currency: 'USD', currentBalance: 10500.00, availableBalance: 10500.00 },
    { id: 'acc_3', userId: 'mock-user-id', itemId: 'item_456', name: 'Amex Gold', officialName: 'American Express Gold Card', mask: '8888', type: 'credit', subtype: 'credit card', currency: 'USD', currentBalance: -842.50 },
];

async function authedFetch(path: string, init?: RequestInit) {
  // This is a mock. In a real app, you'd get the auth token.
  return fetch(path, { ...(init||{}), headers: { 'Content-Type': 'application/json', Authorization: `Bearer mock-token` } });
}

export default function AccountsPage(){
  const [uid] = useState<string|null>('mock-user-id');
  const [items, setItems] = useState<Institution[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(()=> {
    if (!uid) return;
    setItems(mockInstitutions);
    setAccounts(mockAccounts);
  }, [uid]);

  async function syncItem(itemId: string){
    setSyncing(s => ({...s, [itemId]: true}));
    toast({title: 'Syncing...', description: `Starting sync for item ${itemId}.`});
    // Mock sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    // In a real app: await authedFetch('/api/plaid/sync', { method:'POST', body: JSON.stringify({ item_id: itemId }) });
    toast({title: 'Sync complete!', description: `Item ${itemId} has been synced.`});
    setSyncing(s => ({...s, [itemId]: false}));
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Accounts
            </h1>
            <p className="text-muted-foreground">
                Manage your linked financial institutions and accounts.
            </p>
        </div>
        <Button onClick={() => window.location.href = '/link'}>Link New Account</Button>
      </header>

      <Card>
        <CardHeader>
            <CardTitle>Linked Institutions</CardTitle>
            <CardDescription>Your connected bank accounts. Sync to pull the latest transactions.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Sync</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map(i => (
                        <TableRow key={i.id}>
                            <TableCell className="font-mono">{i.id}</TableCell>
                            <TableCell><Badge>{i.status}</Badge></TableCell>
                            <TableCell>{new Date(i.lastSyncAt!).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" onClick={()=> syncItem(i.id)} disabled={syncing[i.id]}>
                                    {syncing[i.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Sync Now
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>All financial accounts discovered from your linked institutions.</CardDescription>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {accounts.map(a => (
                        <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.name} (**** {a.mask})</TableCell>
                            <TableCell className="text-muted-foreground">{a.type}/{a.subtype}</TableCell>
                            <TableCell className="text-right font-mono">{new Intl.NumberFormat('en-US', { style: 'currency', currency: a.currency || 'USD' }).format(a.currentBalance || 0)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
