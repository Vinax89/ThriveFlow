export type Transaction = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
};

export type Debt = {
  id: string;
  name: string;
  totalAmount: number;
  amountPaid: number;
  interestRate: number;
  type: 'Credit Card' | 'Loan' | 'BNPL';
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  imageUrl: string;
  imageHint: string;
};
