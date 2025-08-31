'use server';

import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-admin';
import type { Obligation } from '@/lib/types';


export async function listObligations(userId: string): Promise<Obligation[]> {
  const q = query(collection(db, 'obligations'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Obligation);
}

export async function upsertObligation(o: Obligation) {
  await setDoc(doc(db, 'obligations', o.id), o, { merge: true });
}

export async function removeObligation(id: string) { await deleteDoc(doc(db, 'obligations', id)); }
