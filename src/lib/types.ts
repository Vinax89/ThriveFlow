export type Transaction = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  userCategory?: string;
  aiCategory?: string;
  account_id?: string;
  receiptId?: string;
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
  id:string;
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
  openingBalance?: number;
  allowNegative?: boolean;
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

export const NURSE_CATEGORIES = [
  'scrubs_uniforms', 'ceu_licensure', 'agency_fees', 'housing_overage', 'travel_mileage', 'travel_lodging', 'meals_on_shift', 'equipment_supplies', 'parking', 'union_dues', 'insurance', 'utilities', 'groceries', 'transportation', 'health', 'entertainment', 'income', 'other'
] as const;
export type NurseCategory = typeof NURSE_CATEGORIES[number];

export type Rule = {
  id: string;
  userId: string;
  priority: number;
  enabled: boolean;
  match: {
    merchantContains: string[];
    categoryEquals: string[];
    minAmount?: number;
    maxAmount?: number;
    accountIds: string[];
  };
  action: { nurseCategory: NurseCategory };
};

export type Institution = {
  id: string;
  userId: string;
  accessToken?: string;
  cursor?: string | null;
  status?: string;
  createdAt?: string;
  lastSyncAt?: string;
};

export type Account = {
  id: string;
  userId: string;
  itemId: string;
  name?: string;
  officialName?: string;
  mask?: string;
  type?: string;
  subtype?: string;
  currency?: string;
  currentBalance?: number;
  availableBalance?: number;
  lastSyncAt?: string;
};

export type Receipt = {
  id: string;
  userId: string;
  storagePath: string;
  sha256: string;
  source: 'web' | 'mobile';
  ocr: {
    status: 'queued' | 'parsed' | 'needs_review' | 'failed';
    provider?: string;
    providerVersion?: string;
    extractedAt?: string;
    confidence?: number;
    kv?: Record<string, any>;
    warnings?: string[];
  };
  linkedTx: string[];
  createdAt?: string;
};

export type BNPLPlan = {
  id: string;
  userId: string;
  provider: string;
  description: string;
  total: number;
  installments: number;
  startDate: string; // YYYY-MM-DD
  cadence: 'weekly' | 'biweekly' | 'monthly';
};

export type Obligation = {
    id: string;
    userId: string;
    name: string;
    amount: number;
    cadence: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'none';
    nextDueDate: string; // YYYY-MM-DD
};

export type DebtAccount = {
  id: string;
  userId: string;
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
};
