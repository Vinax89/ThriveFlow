'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getCashFlowProjection } from '@/app/actions';
import { Wand2, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  income: z.coerce.number().min(0, "Income must be a positive number."),
  expenses: z.coerce.number().min(0, "Expenses must be a positive number."),
  debts: z.coerce.number().min(0, "Debts must be a positive number."),
});

type FormData = z.infer<typeof formSchema>;

export function CashFlowProjection() {
  const [isLoading, setIsLoading] = useState(false);
  const [projection, setProjection] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      income: 5345,
      expenses: 2810,
      debts: 12400,
    },
  });

  const onSubmit = async (values: FormData) => {
    setIsLoading(true);
    setProjection(null);

    const result = await getCashFlowProjection(values);

    if (result.success && result.data) {
      setProjection(result.data.projectedCashFlow);
    } else {
      toast({
        variant: 'destructive',
        title: 'Projection Failed',
        description: result.error || 'Could not generate your cash flow projection.',
      });
    }

    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
            <Wand2 className="h-6 w-6 text-primary" />
            <CardTitle>AI Cash Flow Projection</CardTitle>
        </div>
        <CardDescription>
          Let our AI predict your future cash flow based on your current financials.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Monthly Income</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expenses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Monthly Expenses</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="3000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="debts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Outstanding Debt</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="10000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {projection && (
                <div className='pt-4'>
                    <Separator className='my-4' />
                    <h3 className='font-semibold text-lg mb-2'>Your Projection:</h3>
                    <p className='text-sm text-foreground/80 whitespace-pre-wrap'>{projection}</p>
                </div>
            )}
             {isLoading && (
                <div className='pt-4 flex items-center justify-center flex-col gap-4'>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className='text-muted-foreground'>Generating your financial forecast...</p>
                </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Projection'
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
