import { Hero } from '@/components/landing/hero';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <Hero />
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Take Control of Your Finances
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          ThriveFlow helps you track your spending, manage budgets, and achieve your financial goals with ease.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button asChild size="lg">
            <Link href="/dashboard">Get Started</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
