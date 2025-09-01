import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { DebtAccount } from '@/lib/types';
import { Badge } from '../ui/badge';

const mockDebts: DebtAccount[] = [
  { id: '1', name: 'Student Loan', balance: 25000, minPayment: 250, apr: 5.5, userId: 'mock-user-id' },
  { id: '2', name: 'Visa Gold', balance: 5000, minPayment: 100, apr: 18.9, userId: 'mock-user-id' },
  { id: '3', name: 'Car Loan', balance: 18000, minPayment: 350, apr: 4.2, userId: 'mock-user-id' },
];

export function DebtManager() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Debt Management</CardTitle>
          <CardDescription>Manage and pay off your debts.</CardDescription>
        </div>
         <Button size="sm" variant="ghost">
            View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {mockDebts.map((debt) => (
            <div key={debt.id}>
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">{debt.name}</span>
                <Badge variant={'outline'}>DEBT</Badge>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
                 <span>{`$${(debt.balance).toLocaleString()} remaining`}</span>
                 <span className="font-mono">{`${debt.apr.toFixed(1)}% APR`}</span>
              </div>
              <Progress value={(1 - (debt.balance / (debt.balance + 1000))) * 100} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
