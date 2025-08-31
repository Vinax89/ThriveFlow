'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html>
        <body>
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-2xl text-destructive">Something went sideways</CardTitle>
                        <CardDescription>{error.message || 'An unexpected error occurred.'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => reset()}>Try again</Button>
                    </CardContent>
                </Card>
            </div>
        </body>
    </html>
  );
}
