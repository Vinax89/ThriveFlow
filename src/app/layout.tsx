import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import ThemeToggle from '@/components/ThemeToggle';
import { Shortcuts } from '@/components/Shortcuts';


export const metadata: Metadata = {
  title: 'ThriveFlow',
  description: 'Take control of your finances and build a brighter financial future.',
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
      </head>
      <body className="font-body antialiased">
        <nav className="p-4 flex">
          <div className="ml-auto"><ThemeToggle /></div>
        </nav>
        {children}
        <Toaster />
        <Shortcuts />
      </body>
    </html>
  );
}
