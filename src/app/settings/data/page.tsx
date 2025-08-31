'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, GoogleAuthProvider, reauthenticateWithPopup, signOut } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { authedFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function DataSettings(){
  const [uid, setUid] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const auth = getAuth();

  useEffect(()=> onAuthStateChanged(auth, u=> setUid(u?.uid ?? null)), [auth]);

  async function downloadExport(){
    setBusy(true);
    try {
      const t = await auth.currentUser?.getIdToken();
      const r = await fetch('/api/export/download', { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) {
        throw new Error('Export failed');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `thriveflow-export-${new Date().toISOString().slice(0,10)}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch(e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(){
    if (confirm !== 'DELETE') { alert('Type DELETE to confirm'); return; }
    setBusy(true);
    try {
      // Re-authenticate for safety
      const user = auth.currentUser!;
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
      const r = await authedFetch('/api/account/delete', { method: 'POST' });
      if (!r.ok) throw new Error('Delete failed');
      alert('Account deleted.');
      await signOut(auth);
      window.location.href = '/';
    } catch (e:any) {
      alert(e.message);
    } finally { setBusy(false); }
  }

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Data & Privacy
        </h1>
        <p className="text-muted-foreground">
          Manage your account data.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Export Your Data</CardTitle>
          <CardDescription>Downloads a ZIP file containing CSVs for all of your data, including transactions, budgets, debts, and more.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadExport} disabled={!uid || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Download Export
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone: Delete Account</CardTitle>
          <CardDescription>This will permanently delete all of your data, including bank connections, transactions, budgets, and goals. This action cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Label htmlFor="delete-confirm">Type <span className="font-bold text-destructive">DELETE</span> to confirm.</Label>
                <Input id="delete-confirm" className="max-w-xs mt-1" placeholder="DELETE" value={confirm} onChange={e=> setConfirm(e.target.value)} />
            </div>
          <Button variant="destructive" onClick={doDelete} disabled={!uid || busy || confirm !== 'DELETE'}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete My Account Permanently
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
