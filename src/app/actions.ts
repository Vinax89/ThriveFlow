'use server';

import {
  cashFlowProjection,
  type CashFlowProjectionInput,
  type CashFlowProjectionOutput,
} from '@/ai/flows/cash-flow-projection';
import { z } from 'zod';

const InputSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  debts: z.number(),
});


export async function getCashFlowProjection(input: CashFlowProjectionInput): Promise<{
  success: boolean;
  data?: CashFlowProjectionOutput;
  error?: string;
}> {
  const parsedInput = InputSchema.safeParse(input);

  if (!parsedInput.success) {
    return { success: false, error: 'Invalid input.' };
  }

  try {
    const result = await cashFlowProjection(parsedInput.data);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error in cashFlowProjection action:', error);
    return { success: false, error: 'An unexpected error occurred while generating the projection.' };
  }
}

export async function runRecategorize() {
    console.log("Recategorizing recent transactions (mock)...");
    return { ok: true, processed: 0 };
}
