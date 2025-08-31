'use server';

import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-admin';
import type { DebtAccount } from '@/lib/types';


export async function listDebts(userId: string): Promise<DebtAccount[]> {
  const q = query(collection(db, 'debts_accounts'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as DebtAccount);
}

export async function upsertDebt(a: DebtAccount) {
  await setDoc(doc(db, 'debts_accounts', a.id), a, { merge: true });
}

export async function removeDebt(id: string) {
  await deleteDoc(doc(db, 'debts_accounts', id));
}