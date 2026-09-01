export type WalletSummary = {
  availableBalance: string;
  heldBalance: string;
  currency: "COIN";
  coinTryRate: string;
  withdrawalFeeRate: string;
  simulation: true;
};

export type WalletTransaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "HOLD" | "RELEASE" | "SALE" | "REFUND";
  orderId?: string | null;
  amount: string;
  fee: string;
  description: string;
  availableBefore: string;
  availableAfter: string;
  heldBefore: string;
  heldAfter: string;
  createdAt: string;
  reference?: {
    kind: "DEPOSIT" | "WITHDRAWAL";
    id: string;
    amountTry?: string;
    amountCoin?: string;
    coinTryRate: string;
    coinAmount?: string;
    feeRate?: string;
    feeCoin?: string;
    netAmountTry?: string;
    ibanMasked?: string;
    accountHolderName?: string;
    status: "COMPLETED";
  };
};

export type WalletPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type WalletPage<T> = {
  items: T[];
  pagination: WalletPagination;
};

export type Deposit = {
  id: string;
  amountTry: string;
  coinTryRate: string;
  coinAmount: string;
  status: "COMPLETED";
  createdAt: string;
};

export type Withdrawal = {
  id: string;
  amountCoin: string;
  coinTryRate: string;
  feeRate: string;
  feeCoin: string;
  netAmountTry: string;
  ibanMasked: string;
  accountHolderName: string;
  status: "COMPLETED";
  createdAt: string;
};

export type WithdrawalPreview = {
  amountCoin: string;
  coinTryRate: string;
  feeRate: string;
  feeCoin: string;
  netAmountTry: string;
  availableBalance: string;
  canWithdraw: boolean;
  simulation: true;
};

export type DepositResult = {
  wallet: WalletSummary;
  deposit: Deposit;
  transaction: WalletTransaction;
  simulation: true;
};

export type WithdrawalResult = {
  wallet: WalletSummary;
  withdrawal: Withdrawal;
  transaction: WalletTransaction;
  simulation: true;
};
