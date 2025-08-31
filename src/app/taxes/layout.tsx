import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Taxes | ThriveFlow',
  description: 'Estimate your state taxes.',
};

export default function TaxesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
