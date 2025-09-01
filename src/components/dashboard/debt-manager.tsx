import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import type { DebtAccount } from '@/lib/types';
import { Badge } from '../ui/badge';

const mockDebts: { id: string; name: string; totalAmount: number; amountPaid: number; interestRate: number, type: 'Credit Card' | 'Loan' | 'BNPL' }[] = [
  { id: '1', name: 'Student Loan', totalAmount: 25000, amountPaid: 7500, interestRate: 5.5, type: 'Loan' },
  { id: '2', name: 'Visa Gold', totalAmount: 5000, amountPaid: 1200, interestRate: 18.9, type: 'Credit Card' },
  { id: '3', name: 'Klarna - New Laptop', totalAmount: 1500, amountPaid: 900, interestRate: 0, type: 'BNPL' },
  { id: '4', name: 'Car Loan', totalAmount: 18000, amountPaid: 15000, interestRate: 4.2, type: 'Loan' },
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
                <Badge variant={debt.type === 'BNPL' ? 'secondary' : 'outline'}>{debt.type}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
                 <span>{`$${(debt.totalAmount - debt.amountPaid).toLocaleString()} remaining`}</span>
                 <span className="font-mono">{`$${debt.totalAmount.toLocaleString()}`}</span>
              </div>
              <Progress value={(debt.amountPaid / debt.totalAmount) * 100} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
