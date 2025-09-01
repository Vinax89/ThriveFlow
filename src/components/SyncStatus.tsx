'use client';
import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, limit, getFirestore } from 'firebase/firestore';
import { getApps } from 'firebase/app';
import { CircleDot, Wifi, WifiOff } from 'lucide-react';
import { db } from '@/lib/firebase-client';

export function SyncStatus(){
  const [online, setOnline] = useState<boolean>(true);
  const [pending, setPending] = useState<boolean>(false);

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on); window.addEventListener('offline', on);
    on();
    
    // Listen to any collection to detect hasPendingWrites
    // This assumes firebase has been initialized.
    if (getApps().length > 0) {
        const unsub = onSnapshot(query(collection(db, 'rules'), limit(1)), { includeMetadataChanges: true }, snap => {
            setPending(snap.metadata.hasPendingWrites);
        });
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); unsub(); };
    }


    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 rounded-full shadow-lg px-3 py-2 text-sm flex items-center gap-2 bg-card border text-card-foreground">
      {online ? <Wifi className="text-green-500" /> : <WifiOff className="text-muted-foreground" />}
      <span>{online ? 'Online' : 'Offline'}</span>
      {pending && <span className="ml-2 flex items-center gap-2 text-primary animate-pulse"><CircleDot className="animate-spin size-4" /> Syncing…</span>}
    </div>
  );
}
