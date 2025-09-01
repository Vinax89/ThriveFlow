import type {Metadata} from 'next';
import './globals.css';
import { Toaster as SonnerToaster } from 'sonner';
import { Toaster } from "@/components/ui/toaster";
import ThemeToggle from '@/components/ThemeToggle';
import { Shortcuts } from '@/components/Shortcuts';
import { SyncStatus } from '@/components/SyncStatus';
import PWAClient from './pwa-client';
import { PerfProvider, HeadSpeed, NetworkBadge, ProfilerPane } from '@/components/perf-kit';


export const metadata: Metadata = {
  title: 'ThriveFlow',
  description: 'Take control of your finances and build a brighter financial future.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <HeadSpeed />
      </head>
      <body className="font-body antialiased">
        <PerfProvider>
          <PWAClient />
          <nav className="p-4 flex">
            <div className="ml-auto flex items-center gap-4">
              <NetworkBadge />
              <ThemeToggle />
            </div>
          </nav>
          {children}
          <Toaster />
          <SonnerToaster richColors closeButton />
          <Shortcuts />
          <SyncStatus />
          <ProfilerPane />
        </PerfProvider>
      </body>
    </html>
  );
}
