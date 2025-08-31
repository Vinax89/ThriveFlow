'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
// In a real app, you would use the usePlaidLink hook from react-plaid-link
// For this prototype, we'll simulate the flow.

async function authedFetch(path: string, init?: RequestInit) {
  // This is a mock. In a real app, you'd get the auth token.
  return fetch(path, { ...(init||{}), headers: { 'Content-Type': 'application/json', Authorization: `Bearer mock-token` } });
}


export default function LinkPage(){
  const [token, setToken] = useState<string|null>(null);
  const [status, setStatus] = useState('Ready to link an account.');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  async function makeToken(){
    setStatus('Requesting link token…');
    // MOCK: In a real app, you would fetch this from your backend
    setTimeout(() => {
        setToken('mock-link-token');
        setStatus('Ready to link an account.');
        setIsLoading(false);
    }, 1000);
  }

  useEffect(()=>{ makeToken().catch(e => {
    console.error(e);
    toast({ variant: 'destructive', title: 'Error', description: 'Could not create link token.'});
    setStatus('Error initializing Plaid Link.');
  }); }, [toast]);

  async function handleSuccess(public_token: string) {
    setIsLoading(true);
    setStatus('Exchanging token…');
    toast({ title: 'Linking...', description: 'Exchanging public token.' });

    // MOCK: In a real app, you would call your backend to exchange the public token
    // and then trigger the initial sync.
    setTimeout(async () => {
        const mock_item_id = `item_${Date.now()}`;
        setStatus('Linked. Kicking off initial sync…');
        toast({ title: 'Syncing...', description: `Item ${mock_item_id} linked. Starting sync.` });

        setTimeout(() => {
            setStatus('Done. Your account is linked and transactions are syncing.');
            toast({ title: 'Success!', description: 'Account linked and synced.'});
            setIsLoading(false);
        }, 2000);
    }, 1500);
  }
  
  const handleOpenLink = () => {
    setIsLoading(true);
    setStatus('Opening Plaid Link...');
    // MOCK: This simulates the Plaid Link flow opening and returning a public token
    setTimeout(() => {
        handleSuccess('mock-public-token');
    }, 2000);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
       <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Link a Bank Account
        </h1>
        <p className="text-muted-foreground">
          Securely connect your financial accounts via Plaid.
        </p>
      </header>

       <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Plaid Link</CardTitle>
          <CardDescription>{status}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleOpenLink} disabled={isLoading || !token}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Processing...' : 'Open Plaid Link & Connect'}
          </Button>
        </CardContent>
       </Card>
    </div>
  );
}
