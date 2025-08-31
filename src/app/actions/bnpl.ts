'use server';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-admin';
import type { BNPLPlan } from '@/lib/types';


export async function listBNPL(userId: string): Promise<BNPLPlan[]> {
  const q = query(collection(db, 'bnpl_plans'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as BNPLPlan);
}

export async function upsertBNPL(p: BNPLPlan) {
  await setDoc(doc(db, 'bnpl_plans', p.id), p, { merge: true });
}

export async function removeBNPL(id: string) { await deleteDoc(doc(db, 'bnpl_plans', id)); }
