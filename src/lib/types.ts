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

export type Envelope = {
  category: string;
  planned: number;
  carryover: boolean;
};

export type Budget = {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  envelopes: Envelope[];
  locked: boolean;
  createdAt?: string;
  updatedAt?: string;
};
