'use server';

import { collection, query, where, orderBy, limit, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase-admin';
import type { Transaction } from '@/lib/types';


export async function listTransactions(userId: string, take = 200) {
  const q = query(collection(db, 'transactions'), where('userId','==', userId), orderBy('date','desc'), limit(take));
  const snap = await getDocs(q);
  const rows = snap.docs.map(d => d.data() as Transaction);
  return { rows };
}

export async function upsertTransactionsBulk(rows: Transaction[]) {
  const batch = writeBatch(db);
  let count = 0;
  for (const t of rows) {
    const ref = doc(db, 'transactions', t.id);
    batch.set(ref, t, { merge: true });
    count++;
    if (count % 450 === 0) {
      await batch.commit();
    }
  }
  if (count % 450 !== 0) await batch.commit();
}
