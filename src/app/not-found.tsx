import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound(){
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
            <CardTitle className="text-4xl font-bold">404</CardTitle>
            <CardDescription className="text-lg">The page you seek has wandered off.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
        </CardContent>
      </Card>
    </main>
  );
}
