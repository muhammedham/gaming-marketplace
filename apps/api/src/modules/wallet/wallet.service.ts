import { Prisma, WalletTransactionType } from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { WalletAmount } from "./wallet.schemas.js";

const walletInclude = { wallet: true } satisfies Prisma.UserInclude;
type UserWithWallet = Prisma.UserGetPayload<{ include: typeof walletInclude }>;

function amountValue(input: WalletAmount) {
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lessThanOrEqualTo(0)) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", {
      amount: ["Amount must be greater than zero."],
    });
  }
  return amount;
}

function toWallet(user: UserWithWallet) {
  if (!user.wallet) {
    throw new AppError(500, "WALLET_NOT_FOUND", "The account wallet is missing.");
  }

  return {
    availableBalance: user.wallet.availableBalance.toFixed(2),
    heldBalance: user.wallet.heldBalance.toFixed(2),
    currency: "COIN" as const,
  };
}

function validateIdempotentRequest(
  transaction: { walletId: string; type: WalletTransactionType; amount: Prisma.Decimal },
  walletId: string,
  type: WalletTransactionType,
  amount: Prisma.Decimal,
) {
  if (transaction.walletId !== walletId || transaction.type !== type || !transaction.amount.equals(amount)) {
    throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used for another request.");
  }
}

async function assertLedgerConsistency(
  walletId: string,
  availableBalance: Prisma.Decimal,
  heldBalance: Prisma.Decimal,
  tx: Prisma.TransactionClient,
) {
  const latest = await tx.walletTransaction.findFirst({
    where: { walletId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (
    latest &&
    (!latest.availableAfter.equals(availableBalance) || !latest.heldAfter.equals(heldBalance))
  ) {
    throw new AppError(500, "LEDGER_INCONSISTENT", "The wallet ledger does not match its current balance.");
  }
}

export async function getWallet(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: walletInclude });
  if (!user) {
    throw new AppError(401, "SESSION_USER_NOT_FOUND", "The session is no longer valid.");
  }
  return toWallet(user);
}

export async function deposit(userId: string, input: WalletAmount) {
  const amount = amountValue(input);
  const user = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: userId }, include: walletInclude });
    if (!current?.wallet) {
      throw new AppError(401, "SESSION_USER_NOT_FOUND", "The session is no longer valid.");
    }
    await assertLedgerConsistency(current.wallet.id, current.wallet.availableBalance, current.wallet.heldBalance, tx);

    const previous = await tx.walletTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (previous) {
      validateIdempotentRequest(previous, current.wallet.id, WalletTransactionType.DEPOSIT, amount);
      return current;
    }

    await tx.wallet.update({
      where: { id: current.wallet.id },
      data: { availableBalance: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: current.wallet.id,
        type: WalletTransactionType.DEPOSIT,
        amount,
        idempotencyKey: input.idempotencyKey,
        availableBefore: current.wallet.availableBalance,
        availableAfter: current.wallet.availableBalance.add(amount),
        heldBefore: current.wallet.heldBalance,
        heldAfter: current.wallet.heldBalance,
      },
    });
    return tx.user.findUniqueOrThrow({ where: { id: userId }, include: walletInclude });
  });

  return toWallet(user);
}

export async function withdraw(userId: string, input: WalletAmount) {
  const amount = amountValue(input);
  const user = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: userId }, include: walletInclude });
    if (!current?.wallet) {
      throw new AppError(401, "SESSION_USER_NOT_FOUND", "The session is no longer valid.");
    }
    await assertLedgerConsistency(current.wallet.id, current.wallet.availableBalance, current.wallet.heldBalance, tx);

    const previous = await tx.walletTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (previous) {
      validateIdempotentRequest(previous, current.wallet.id, WalletTransactionType.WITHDRAWAL, amount);
      return current;
    }

    const updated = await tx.wallet.updateMany({
      where: { id: current.wallet.id, availableBalance: { gte: amount } },
      data: { availableBalance: { decrement: amount } },
    });
    if (updated.count !== 1) {
      throw new AppError(400, "INSUFFICIENT_FUNDS", "Available balance is not sufficient.");
    }

    await tx.walletTransaction.create({
      data: {
        walletId: current.wallet.id,
        type: WalletTransactionType.WITHDRAWAL,
        amount,
        idempotencyKey: input.idempotencyKey,
        availableBefore: current.wallet.availableBalance,
        availableAfter: current.wallet.availableBalance.sub(amount),
        heldBefore: current.wallet.heldBalance,
        heldAfter: current.wallet.heldBalance,
      },
    });
    return tx.user.findUniqueOrThrow({ where: { id: userId }, include: walletInclude });
  });

  return toWallet(user);
}