import { apiRequest } from "../../lib/api-client";
import type {
  DepositResult,
  Deposit,
  WalletPage,
  WalletSummary,
  WalletTransaction,
  WithdrawalPreview,
  WithdrawalResult,
  Withdrawal,
} from "./types";

export const walletKeys = {
  all: ["wallet"] as const,
  summary: () => [...walletKeys.all, "summary"] as const,
  transactions: () => [...walletKeys.all, "transactions"] as const,
  deposits: () => [...walletKeys.all, "deposits"] as const,
  withdrawals: () => [...walletKeys.all, "withdrawals"] as const,
};

export function getWallet() {
  return apiRequest<WalletSummary>("/wallet");
}

export function listWalletTransactions() {
  return apiRequest<WalletPage<WalletTransaction>>("/wallet/transactions?limit=50");
}

export function listDeposits() {
  return apiRequest<WalletPage<Deposit>>("/wallet/deposits?limit=50");
}

export function listWithdrawals() {
  return apiRequest<WalletPage<Withdrawal>>("/wallet/withdrawals?limit=50");
}

export function simulateDeposit(input: { amountTry: string; idempotencyKey: string }) {
  return apiRequest<DepositResult>("/wallet/deposits/simulate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function previewWithdrawal(amountCoin: string) {
  return apiRequest<WithdrawalPreview>("/wallet/withdrawals/preview", {
    method: "POST",
    body: JSON.stringify({ amountCoin }),
  });
}

export function simulateWithdrawal(input: {
  amountCoin: string;
  iban: string;
  accountHolderName: string;
  idempotencyKey: string;
}) {
  return apiRequest<WithdrawalResult>("/wallet/withdrawals/simulate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
