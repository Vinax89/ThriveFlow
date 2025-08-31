'use server';

/**
 * @fileOverview Projects future cash flow based on user-provided income, expenses, and debts.
 *
 * - cashFlowProjection - A function that handles the cash flow projection process.
 * - CashFlowProjectionInput - The input type for the cashFlowProjection function.
 * - CashFlowProjectionOutput - The return type for the cashFlowProjection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CashFlowProjectionInputSchema = z.object({
  income: z.number().describe('Total monthly income.'),
  expenses: z.number().describe('Total monthly expenses.'),
  debts: z.number().describe('Total outstanding debt.'),
});
export type CashFlowProjectionInput = z.infer<typeof CashFlowProjectionInputSchema>;

const CashFlowProjectionOutputSchema = z.object({
  projectedCashFlow: z
    .string()
    .describe('A projection of future cash flow, including potential challenges and opportunities.'),
});
export type CashFlowProjectionOutput = z.infer<typeof CashFlowProjectionOutputSchema>;

export async function cashFlowProjection(input: CashFlowProjectionInput): Promise<CashFlowProjectionOutput> {
  return cashFlowProjectionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cashFlowProjectionPrompt',
  input: {schema: CashFlowProjectionInputSchema},
  output: {schema: CashFlowProjectionOutputSchema},
  prompt: `Based on the following financial information, project the user's future cash flow, including potential challenges and opportunities.  Provide a detailed explanation of the projections.

Income: {{{income}}}
Expenses: {{{expenses}}}
Debts: {{{debts}}}`,
});

const cashFlowProjectionFlow = ai.defineFlow(
  {
    name: 'cashFlowProjectionFlow',
    inputSchema: CashFlowProjectionInputSchema,
    outputSchema: CashFlowProjectionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
