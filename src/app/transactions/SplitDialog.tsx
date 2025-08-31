'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Trash2, PlusCircle } from 'lucide-react';
import type { Transaction, TxSplit } from '@/lib/types';

export default function SplitDialog({ open, onClose, tx }:{ open:boolean; onClose:()=>void; tx: Transaction }){
  const [items, setItems] = useState<TxSplit[]>([]);
  
  useEffect(()=> { 
    if (open) {
        if (tx.splits && tx.splits.length > 0) {
            setItems(tx.splits);
        } else {
            // Default to a single split representing the original transaction
            setItems([{ amount: tx.amount, userCategory: tx.userCategory || tx.category, note: tx.description }]);
        }
    }
  }, [open, tx]);
  
  const total = items.reduce((s,i)=> s + (Number(i.amount)||0), 0);
  const diff = Math.round((total - tx.amount) * 100) / 100;

  function add(){ setItems(arr => [...arr, { amount: 0, userCategory: 'other', note: '' }]); }
  function remove(i: number){ setItems(arr => arr.filter((_,idx)=> idx!==i)); }

  async function save(){
    if (Math.abs(diff) > 0.01) { alert(`Splits must sum to ${tx.amount.toFixed(2)} (difference is ${diff.toFixed(2)})`); return; }
    await setDoc(doc(db,'transactions', tx.id), { splits: items, updatedAt: new Date().toISOString() }, { merge: true });
    onClose();
  }

  async function createRuleFromSplit(){
    const first = items[0]; if (!first) return;
    const words = (tx.description || '').toLowerCase().split(/\s+/).filter(w=> w.length >= 4).slice(0,2);
    const min = Math.abs(first.amount) - 0.05; 
    const max = Math.abs(first.amount) + 0.05;
    const id = crypto.randomUUID();
    await setDoc(doc(db,'rules', id), { 
        id, 
        userId: tx.userId, 
        priority: 90, 
        enabled: true, 
        match: { 
            merchantContains: words, 
            categoryEquals: [], 
            minAmount: min, 
            maxAmount: max, 
            accountIds: [] 
        }, 
        action: { nurseCategory: first.userCategory || 'other' } 
    });
    alert('Rule created');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Split Transaction: {tx.description} ({tx.amount.toFixed(2)})</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
                {items.map((it, i)=> (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <Input className="col-span-5" placeholder="Category" value={it.userCategory||''} onChange={e=> setItems(arr => arr.map((x,idx)=> idx===i? { ...x, userCategory: e.target.value }: x))} />
                        <Input className="col-span-4" placeholder="Note" value={it.note||''} onChange={e=> setItems(arr => arr.map((x,idx)=> idx===i? { ...x, note: e.target.value }: x))} />
                        <Input className="col-span-2 text-right" type="number" step="0.01" value={String(it.amount)} onChange={e=> setItems(arr => arr.map((x,idx)=> idx===i? { ...x, amount: Number(e.target.value) }: x))} />
                        <Button variant="ghost" size="icon" className="col-span-1" onClick={()=> remove(i)}><Trash2 className="size-4 text-muted-foreground" /></Button>
                    </div>
                ))}
                 <div className="flex items-center gap-4 pt-2">
                    <Button variant="outline" size="sm" onClick={add}><PlusCircle className="mr-2"/> Add Split</Button>
                    <div className="text-sm text-muted-foreground">
                        Sum: <span className="font-mono">{total.toFixed(2)}</span> · 
                        Difference: <span className={`font-mono ${Math.abs(diff) > 0.01 ? 'text-destructive' : 'text-green-600'}`}>{diff.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={createRuleFromSplit}>Create rule from first split</Button>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={save} disabled={Math.abs(diff) > 0.01}>Save Splits</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
