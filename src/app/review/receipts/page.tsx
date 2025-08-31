'use client';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, orderBy, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';

function uploadReceipt(storage: any, file: File, uid: string, onProgress: (pct:number)=>void): Promise<string> {
  const yyyy = new Date().getFullYear();
  const mm = String(new Date().getMonth()+1).padStart(2,'0');
  const id = crypto.randomUUID();
  const path = `receipts/${uid}/${yyyy}/${mm}/${id}.jpg`;
  const metadata = { customMetadata: { uid } } as any;
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, metadata);
    task.on('state_changed', s => {
      onProgress(Math.round((s.bytesTransferred / s.totalBytes)*100));
    }, reject, () => resolve(path));
  });
}

function ManualLink({ uid, receiptId, onLink }: { uid:string, receiptId:string, onLink: () => void }){
  const [tx, setTx] = useState<any[]>([]);
  const [picked, setPicked] = useState('');
  const [db, setDb] = useState<any>(null);

  useEffect(()=> { (async()=>{
    const { getFirestore } = await import('firebase/firestore');
    const firestore = getFirestore();
    setDb(firestore);
    const snap = await getDocs(query(collection(firestore,'transactions'), where('userId','==', uid), orderBy('date','desc'), limit(200)));
    setTx(snap.docs.map(d=> ({ id:d.id, ...(d.data() as any) })));
  })(); }, [uid]);

  async function handleLink() {
      if (!db || !picked) return;
      await setDoc(doc(db,'transactions', picked), { receiptId: receiptId }, { merge: true });
      await setDoc(doc(db,'receipts', receiptId), { linkedTx: [picked] }, { merge: true });
      onLink();
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <select className="border p-2" value={picked} onChange={e=> setPicked(e.target.value)}>
        <option value="">Select transaction…</option>
        {tx.map(t=> <option key={t.id} value={t.id}>{t.date} · {t.description ?? '—'} · ${t.amount.toFixed(2)}</option>)}
      </select>
      <button className="border px-3 py-2" disabled={!picked} onClick={handleLink}>Link</button>
    </div>
  );
}


export default function ReceiptsPage(){
  const [uid, setUid] = useState<string|null>(null);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [auth, setAuth] = useState<any>(null);
  const [db, setDb] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);

  useEffect(() => {
    const authInstance = getAuth();
    setAuth(authInstance);
    setDb(getFirestore());
    setStorage(getStorage());
    onAuthStateChanged(authInstance, user => setUid(user?.uid ?? null));
  }, []);

  async function refresh(){
    if(!uid || !db) return; 
    const qs = await getDocs(query(collection(db,'receipts'), where('userId','==', uid)));
    setRows(qs.docs.map(d => d.data()));
  }

  useEffect(()=> { refresh(); }, [uid, db]);

  async function onFile(f?: File){ 
      if(!f || !uid || !storage) return; 
      setProgress(1); 
      await uploadReceipt(storage, f, uid, setProgress); 
      setProgress(100); 
      setTimeout(()=> setProgress(0), 1500); 
      setTimeout(()=> refresh(), 1500); 
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Receipts</h1>
      <input type="file" accept="image/*" onChange={e=> onFile(e.target.files?.[0])} />
      {progress>0 && <div>Upload: {progress}%</div>}
      <ul className="divide-y max-w-3xl">
        {rows.map(r => (
          <li key={r.id} className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{r.ocr?.kv?.merchant ?? 'Unknown merchant'}</div>
                <div className="text-sm text-gray-600">{r.ocr?.kv?.date ?? '—'} · ${r.ocr?.kv?.total ?? '—'} · status: {r.ocr?.status}</div>
              </div>
              <div className="text-sm">{r.linkedTx?.length ? <span className="text-green-700">Linked</span> : <span className="text-amber-700">Needs link</span>}</div>
            </div>
            {!r.linkedTx?.length && uid && (
              <ManualLink uid={uid} receiptId={r.id} onLink={refresh} />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}