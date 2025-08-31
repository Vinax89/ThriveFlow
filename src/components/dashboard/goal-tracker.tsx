import Image from 'next/image';
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
import type { Goal } from '@/lib/types';

const mockGoals: Goal[] = [
  { id: '1', name: 'Dream Vacation to Bali', targetAmount: 4000, currentAmount: 2800, imageUrl: 'https://picsum.photos/600/400', imageHint: 'travel beach' },
  { id: '2', name: 'New MacBook Pro', targetAmount: 2500, currentAmount: 1000, imageUrl: 'https://picsum.photos/600/400', imageHint: 'tech computer' },
  { id: '3', name: 'Emergency Fund', targetAmount: 10000, currentAmount: 9500, imageUrl: 'https://picsum.photos/600/400', imageHint: 'safety security' },
];

export function GoalTracker() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Financial Goals</CardTitle>
          <CardDescription>Track your progress.</CardDescription>
        </div>
        <Button variant="ghost" size="icon">
          <PlusCircle className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {mockGoals.map((goal) => (
          <div key={goal.id} className="group">
            <div className="relative h-32 w-full rounded-lg overflow-hidden mb-3">
               <Image
                src={goal.imageUrl}
                alt={goal.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={goal.imageHint}
              />
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute bottom-2 left-3">
                  <h3 className="text-white font-bold text-lg">{goal.name}</h3>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
              <span className='font-medium'>{`$${goal.currentAmount.toLocaleString()} / $${goal.targetAmount.toLocaleString()}`}</span>
              <span className="font-semibold text-foreground">{`${Math.round((goal.currentAmount / goal.targetAmount) * 100)}%`}</span>
            </div>
            <Progress value={(goal.currentAmount / goal.targetAmount) * 100} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
