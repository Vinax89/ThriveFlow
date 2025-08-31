import { OverviewCards } from '@/components/dashboard/overview-cards';
import { BudgetTracker } from '@/components/dashboard/budget-tracker';
import { DebtManager } from '@/components/dashboard/debt-manager';
import { GoalTracker } from '@/components/dashboard/goal-tracker';
import { CashFlowProjection } from '@/components/dashboard/cash-flow-projection';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome Back, User!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s your financial overview for today.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <OverviewCards />
        </div>
        
        <div className="lg:col-span-2">
          <BudgetTracker />
        </div>

        <div className="lg:col-span-1 row-span-2">
           <GoalTracker />
        </div>

        <div className="lg:col-span-2">
           <DebtManager />
        </div>
        
        <div className="lg:col-span-3">
            <CashFlowProjection />
        </div>

      </div>
    </div>
  );
}
