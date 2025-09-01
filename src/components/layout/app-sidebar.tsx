
'use client';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/icons/logo';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  LayoutDashboard,
  Target,
  Wallet,
  Settings,
  AreaChart,
  ListChecks,
  FileCog,
  Link,
  Landmark,
  Receipt,
  UploadCloud,
  Grid3x3,
  CalendarClock,
  Package,
  Repeat,
  ShieldCheck,
} from 'lucide-react';
import { StableLink } from '@/components/perf-kit';

const menuItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/reports/cashflow',
    label: 'Cashflow',
    icon: AreaChart,
  },
  {
    href: '/reports/heatmap',
    label: 'Heatmap',
    icon: Grid3x3,
  },
  {
    href: '/upcoming',
    label: 'Upcoming',
    icon: CalendarClock,
  },
  {
    href: '/budgets',
    label: 'Budgets',
    icon: Wallet,
  },
  {
    href: '/debts',
    label: 'Debts',
    icon: CreditCard,
  },
  {
    href: '/bnpl',
    label: 'BNPL',
    icon: Package,
  },
  {
    href: '/obligations',
    label: 'Obligations',
    icon: Repeat,
  },
  {
    href: '/goals',
    label: 'Goals',
    icon: Target,
  },
  {
    href: '/taxes',
    label: 'Taxes',
    icon: Receipt,
  },
  {
    href: '/rules',
    label: 'Rules',
    icon: FileCog,
  },
  {
    href: '/review/transactions',
    label: 'Review',
    icon: ListChecks,
  },
  {
    href: '/transactions/reconcile',
    label: 'Reconcile',
    icon: ShieldCheck,
  },
  {
    href: '/review/receipts',
    label: 'Receipts',
    icon: Receipt,
  },
   {
    href: '/transactions/import',
    label: 'Import',
    icon: UploadCloud,
  },
  {
    href: '/link',
    label: 'Link Accounts',
    icon: Link,
  },
  {
    href: '/accounts',
    label: 'Accounts',
    icon: Landmark,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Logo className="size-8" />
          <span className="text-lg font-semibold">ThriveFlow</span>
          <SidebarTrigger className="ml-auto" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                tooltip={item.label}
              >
                <StableLink initialHref={item.href} href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </StableLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
           <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/settings')}
                tooltip="Settings"
              >
                <StableLink initialHref="/settings/data" href="/settings/data">
                  <Settings />
                  <span>Settings</span>
                </StableLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-3 px-2">
          <Avatar className="size-9">
            <AvatarImage src="https://picsum.photos/id/237/100" alt="User avatar" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="font-medium truncate">User</span>
            <span className="text-muted-foreground truncate">user@example.com</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
