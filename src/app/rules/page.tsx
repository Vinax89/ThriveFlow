'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Pencil, Save, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { runRecategorize } from '@/app/actions';
import { type Rule, NURSE_CATEGORIES } from '@/lib/types';


// Mock data and functions
const mockRules: Rule[] = [
    { id: '1', userId: 'mock-user-id', priority: 1, enabled: true, match: { merchantContains: ['starbucks'], categoryEquals: [], accountIds: [] }, action: { nurseCategory: 'meals_on_shift' } },
    { id: '2', userId: 'mock-user-id', priority: 10, enabled: true, match: { merchantContains: ['chevron', 'shell'], categoryEquals: [], accountIds: [] }, action: { nurseCategory: 'transportation' } },
];

async function getRules(userId: string): Promise<Rule[]> {
  console.log('Faking fetch for rules for user:', userId);
  const stored = localStorage.getItem(`rules_${userId}`);
  if (stored) return JSON.parse(stored);
  return mockRules;
}

async function upsertRule(rule: Rule) {
  console.log('Saving rule', rule);
  const rules = await getRules(rule.userId);
  const index = rules.findIndex(r => r.id === rule.id);
  if (index > -1) {
    rules[index] = rule;
  } else {
    rules.push(rule);
  }
  localStorage.setItem(`rules_${rule.userId}`, JSON.stringify(rules));
}

async function removeRule(ruleId: string, userId: string) {
    console.log('Removing rule', ruleId);
    const rules = await getRules(userId);
    const updatedRules = rules.filter(r => r.id !== ruleId);
    localStorage.setItem(`rules_${userId}`, JSON.stringify(updatedRules));
}


export default function RulesPage() {
  const [uid] = useState('mock-user-id');
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingRule, setEditingRule] = useState<Partial<Rule> | null>(null);
  const { toast } = useToast();

  const fetchRules = async () => {
    if (!uid) return;
    const userRules = await getRules(uid);
    setRules(userRules.sort((a,b) => a.priority - b.priority));
  };

  useEffect(() => {
    fetchRules();
  }, [uid]);

  const handleSave = async () => {
    if (!uid || !editingRule) return;

    const ruleToSave: Rule = {
      id: editingRule.id || crypto.randomUUID(),
      userId: uid,
      priority: editingRule.priority ?? 100,
      enabled: editingRule.enabled ?? true,
      match: {
        merchantContains: editingRule.match?.merchantContains || [],
        categoryEquals: editingRule.match?.categoryEquals || [],
        minAmount: editingRule.match?.minAmount,
        maxAmount: editingRule.match?.maxAmount,
        accountIds: editingRule.match?.accountIds || [],
      },
      action: {
        nurseCategory: editingRule.action?.nurseCategory || 'other',
      },
    };

    await upsertRule(ruleToSave);
    await fetchRules();
    setEditingRule(null);
    toast({ title: 'Success', description: 'Rule saved.' });
  };
  
  const handleRecategorize = async () => {
    toast({ title: 'Working...', description: 'Kicking off recategorization for recent transactions.' });
    await runRecategorize();
    toast({ title: 'Success', description: 'Recategorization complete.' });
  }

  const handleRemove = async (ruleId: string) => {
    if (!uid) return;
    await removeRule(ruleId, uid);
    await fetchRules();
    toast({ title: 'Success', description: 'Rule removed.' });
  }
  
  const startNewRule = () => {
    setEditingRule({
        priority: 100,
        enabled: true,
        match: { merchantContains: [], categoryEquals: [], accountIds: [] },
        action: { nurseCategory: 'other' }
    });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Categorization Rules
            </h1>
            <p className="text-muted-foreground">
                Automate your transaction categories.
            </p>
        </div>
        <Button onClick={startNewRule}><PlusCircle className="mr-2"/> Add Rule</Button>
      </header>

      {editingRule && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRule.id ? 'Edit Rule' : 'New Rule'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Merchant Contains (comma-separated)</Label>
                    <Input 
                        value={editingRule.match?.merchantContains?.join(', ')} 
                        onChange={e => setEditingRule(f => ({...f, match: {...f?.match, merchantContains: e.target.value.split(',').map(s => s.trim())}}))}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Provider Category Equals (comma-separated)</Label>
                    <Input 
                        value={editingRule.match?.categoryEquals?.join(', ')}
                        onChange={e => setEditingRule(f => ({...f, match: {...f?.match, categoryEquals: e.target.value.split(',').map(s => s.trim())}}))}
                     />
                </div>
                 <div className="space-y-2">
                    <Label>Priority</Label>
                    <Input type="number" value={editingRule.priority} onChange={e => setEditingRule(f => ({...f, priority: Number(e.target.value)}))} />
                </div>
                <div className="space-y-2">
                    <Label>Set Category To</Label>
                    <Select value={editingRule.action?.nurseCategory} onValueChange={val => setEditingRule(f => ({...f, action: {nurseCategory: val as any}}))}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {NURSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="enabled" checked={editingRule.enabled} onCheckedChange={checked => setEditingRule(f => ({...f, enabled: !!checked}))} />
                    <Label htmlFor="enabled">Enabled</Label>
                </div>
             </div>
             <div className="flex gap-2">
                <Button onClick={handleSave}><Save className="mr-2"/> Save</Button>
                <Button variant="outline" onClick={() => setEditingRule(null)}><XCircle className="mr-2"/> Cancel</Button>
             </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Rules</CardTitle>
          <CardDescription>Rules are applied in order of priority (lowest number first).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.priority}</TableCell>
                  <TableCell className="font-medium">{r.action.nurseCategory}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.match.merchantContains?.length > 0 && `Merchant contains [${r.match.merchantContains.join(', ')}] `}
                    {r.match.categoryEquals?.length > 0 && `Category is [${r.match.categoryEquals.join(', ')}]`}
                  </TableCell>
                  <TableCell>{r.enabled ? 'Enabled' : 'Disabled'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditingRule(r)}><Pencil className="size-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(r.id)}><Trash2 className="size-4"/></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
       <Button onClick={handleRecategorize}>Re-categorize Recent Transactions</Button>
    </div>
  );
}
