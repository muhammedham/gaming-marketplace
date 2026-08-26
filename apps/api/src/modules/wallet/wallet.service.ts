import { Prisma, WalletTransactionType } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type {
  DepositSimulation,
  WalletAmount,
  WalletListQuery,
  WithdrawalSimulation,
} from "./wallet.schemas.js";

const walletInclude = { wallet: true } satisfies Prisma.UserInclude;
type UserWithWallet = Prisma.UserGetPayload<{ include: typeof walletInclude }>;

const decimalZero = new Prisma.Decimal(0);

function amountValue(input: { amount?: string; amountTry?: string; amountCoin?: string }) {
  const raw = input.amount ?? input.amountTry ?? input.amountCoin;
  const amount = new Prisma.Decimal(raw ?? "0");
  if (amount.lessThanOrEqualTo(decimalZero)) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", {
      amount: ["Amount must be greater than zero."],
    });
  }
  return amount;
}

function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function toWallet(user: UserWithWallet, coinTryRate?: Prisma.Decimal, withdrawalFeeRate?: Prisma.Decimal) {
  if (!user.wallet) {
    throw new AppError(500, "WALLET_NOT_FOUND", "The account wallet is missing.");
  }

  return {
    availableBalance: user.wallet.availableBalance.toFixed(2),
    heldBalance: user.wallet.heldBalance.toFixed(2),
    currency: "COIN" as const,
    ...(coinTryRate ? { coinTryRate: coinTryRate.toFixed(6) } : {}),
    ...(withdrawalFeeRate ? { withdrawalFeeRate: withdrawalFeeRate.toFixed(6) } : {}),
    simulation: true as const,
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

async function lockWallet(walletId: string, tx: Prisma.TransactionClient) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM wallets WHERE id = ${walletId}::uuid FOR UPDATE`);
}

async function assertLedgerConsistency(
  walletId: string,
  availableBalance: Prisma.Decimal,
  heldBalance: Prisma.Decimal,
  tx: Prisma.TransactionClient,
) {
  const transactions = await tx.walletTransaction.findMany({
    where: { walletId },
    orderBy: { ledgerSequence: "asc" },
  });
  let expectedAvailable = decimalZero;
  let expectedHeld = decimalZero;
  for (const transaction of transactions) {
    if (!transaction.availableBefore.equals(expectedAvailable) || !transaction.heldBefore.equals(expectedHeld)) {
      throw new AppError(500, "LEDGER_INCONSISTENT", "The wallet ledger does not match its transaction chain.");
    }
    if (transaction.availableAfter.lessThan(decimalZero) || transaction.heldAfter.lessThan(decimalZero)) {
      throw new AppError(500, "LEDGER_INCONSISTENT", "The wallet ledger contains a negative balance.");
    }
    const expectedAfter = transaction.type === WalletTransactionType.DEPOSIT
      ? expectedAvailable.add(transaction.amount)
      : expectedAvailable.sub(transaction.amount);
    if (!transaction.availableAfter.equals(expectedAfter) || !transaction.heldAfter.equals(expectedHeld)) {
      throw new AppError(500, "LEDGER_INCONSISTENT", "The wallet ledger contains an invalid balance change.");
    }
    expectedAvailable = transaction.availableAfter;
    expectedHeld = transaction.heldAfter;
  }
  if (!availableBalance.equals(expectedAvailable) || !heldBalance.equals(expectedHeld)) {
    throw new AppError(500, "LEDGER_INCONSISTENT", "The wallet ledger does not match its current balance.");
  }
}

async function systemSettings(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const settings = await tx.systemSettings.findUnique({ where: { id: 1 } });
  if (!settings || settings.coinTryRate.lessThanOrEqualTo(decimalZero)) {
    throw new AppError(500, "SYSTEM_SETTINGS_MISSING", "Wallet simulation settings are not configured.");
  }
  return settings;
}

function maskIban(value: string) {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  if (!/^TR\d{24}$/.test(normalized)) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", {
      iban: ["Enter a valid Turkish IBAN (TR followed by 24 digits)."],
    });
  }
  return `${normalized.slice(0, 2)}${"*".repeat(normalized.length - 6)}${normalized.slice(-4)}`;
}

function normalizeHolderName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", {
      accountHolderName: ["Account holder name is required."],
    });
  }
  return name;
}

function walletFromCurrent(current: { wallet: { availableBalance: Prisma.Decimal; heldBalance: Prisma.Decimal } }, settings: { coinTryRate: Prisma.Decimal; withdrawalFeeRate: Prisma.Decimal }) {
  return {
    availableBalance: current.wallet.availableBalance.toFixed(2),
    heldBalance: current.wallet.heldBalance.toFixed(2),
    currency: "COIN" as const,
    coinTryRate: settings.coinTryRate.toFixed(6),
    withdrawalFeeRate: settings.withdrawalFeeRate.toFixed(6),
    simulation: true as const,
  };
}

function transactionOutput(transaction: Prisma.WalletTransactionGetPayload<{
  include: { deposit: true; withdrawal: true };
}>) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount.toFixed(2),
    fee: transaction.fee.toFixed(2),
    description: transaction.description,
    availableBefore: transaction.availableBefore.toFixed(2),
    availableAfter: transaction.availableAfter.toFixed(2),
    heldBefore: transaction.heldBefore.toFixed(2),
    heldAfter: transaction.heldAfter.toFixed(2),
    createdAt: transaction.createdAt.toISOString(),
    ...(transaction.deposit ? {
      reference: {
        kind: "DEPOSIT" as const,
        id: transaction.deposit.id,
        amountTry: transaction.deposit.amountTry.toFixed(2),
        coinTryRate: transaction.deposit.coinTryRate.toFixed(6),
        coinAmount: transaction.deposit.coinAmount.toFixed(2),
        status: transaction.deposit.status,
      },
    } : {}),
    ...(transaction.withdrawal ? {
      reference: {
        kind: "WITHDRAWAL" as const,
        id: transaction.withdrawal.id,
        amountCoin: transaction.withdrawal.amountCoin.toFixed(2),
        coinTryRate: transaction.withdrawal.coinTryRate.toFixed(6),
        feeRate: transaction.withdrawal.feeRate.toFixed(6),
        feeCoin: transaction.withdrawal.feeCoin.toFixed(2),
        netAmountTry: transaction.withdrawal.netAmountTry.toFixed(2),
        ibanMasked: transaction.withdrawal.ibanMasked,
        accountHolderName: transaction.withdrawal.accountHolderName,
        status: transaction.withdrawal.status,
      },
    } : {}),
  };
}

async function findWalletContext(userId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const current = await tx.user.findUnique({ where: { id: userId }, include: walletInclude });
  if (!current?.wallet) {
    throw new AppError(401, "SESSION_USER_NOT_FOUND", "The session is no longer valid.");
  }
  return current;
}

export async function getWallet(userId: string) {
  const [user, settings] = await Promise.all([findWalletContext(userId), systemSettings()]);
  return toWallet(user, settings.coinTryRate, settings.withdrawalFeeRate);
}

export async function simulateDeposit(userId: string, input: DepositSimulation) {
  const amountTry = amountValue(input);
  return prisma.$transaction(async (tx) => {
    const initial = await findWalletContext(userId, tx);
    await lockWallet(initial.wallet!.id, tx);
    const current = await findWalletContext(userId, tx);
    const settings = await systemSettings(tx);
    const previous = await tx.walletTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { deposit: true, withdrawal: true },
    });
    if (previous) {
      const coinAmount = roundMoney(amountTry.div(settings.coinTryRate));
      validateIdempotentRequest(previous, current.wallet!.id, WalletTransactionType.DEPOSIT, coinAmount);
      return {
        wallet: walletFromCurrent({ wallet: current.wallet! }, settings),
        deposit: previous.deposit ? {
          id: previous.deposit.id,
          amountTry: previous.deposit.amountTry.toFixed(2),
          coinTryRate: previous.deposit.coinTryRate.toFixed(6),
          coinAmount: previous.deposit.coinAmount.toFixed(2),
          status: previous.deposit.status,
          createdAt: previous.deposit.createdAt.toISOString(),
        } : undefined,
        transaction: transactionOutput(previous),
        simulation: true as const,
      };
    }
    await assertLedgerConsistency(current.wallet!.id, current.wallet!.availableBalance, current.wallet!.heldBalance, tx);
    const coinAmount = roundMoney(amountTry.div(settings.coinTryRate));
    if (coinAmount.lessThanOrEqualTo(decimalZero)) {
      throw new AppError(400, "VALIDATION_ERROR", "The TRY amount is too small to produce a Coin balance change.");
    }
    const availableAfter = current.wallet!.availableBalance.add(coinAmount);
    const transactionId = randomUUID();
    const depositId = randomUUID();
    const transaction = await tx.walletTransaction.create({
      data: {
        id: transactionId,
        walletId: current.wallet!.id,
        type: WalletTransactionType.DEPOSIT,
        amount: coinAmount,
        fee: decimalZero,
        idempotencyKey: input.idempotencyKey,
        availableBefore: current.wallet!.availableBalance,
        availableAfter,
        heldBefore: current.wallet!.heldBalance,
        heldAfter: current.wallet!.heldBalance,
        description: `Simulated deposit of ${amountTry.toFixed(2)} TRY`,
      },
      include: { deposit: true, withdrawal: true },
    });
    await tx.deposit.create({
      data: {
        id: depositId,
        walletId: current.wallet!.id,
        transactionId,
        amountTry,
        coinTryRate: settings.coinTryRate,
        coinAmount,
        idempotencyKey: input.idempotencyKey,
      },
    });
    const updated = await tx.wallet.update({
      where: { id: current.wallet!.id },
      data: { availableBalance: availableAfter },
    });
    const created = await tx.walletTransaction.findUniqueOrThrow({
      where: { id: transaction.id },
      include: { deposit: true, withdrawal: true },
    });
    return {
      wallet: walletFromCurrent({ wallet: updated }, settings),
      deposit: {
        id: depositId,
        amountTry: amountTry.toFixed(2),
        coinTryRate: settings.coinTryRate.toFixed(6),
        coinAmount: coinAmount.toFixed(2),
        status: "COMPLETED" as const,
        createdAt: created.createdAt.toISOString(),
      },
      transaction: transactionOutput(created),
      simulation: true as const,
    };
  });
}

export async function previewWithdrawal(userId: string, amountCoinInput: string) {
  const amountCoin = amountValue({ amountCoin: amountCoinInput });
  const [current, settings] = await Promise.all([findWalletContext(userId), systemSettings()]);
  const feeCoin = roundMoney(amountCoin.mul(settings.withdrawalFeeRate));
  const netAmountTry = roundMoney(amountCoin.sub(feeCoin).mul(settings.coinTryRate));
  return {
    amountCoin: amountCoin.toFixed(2),
    coinTryRate: settings.coinTryRate.toFixed(6),
    feeRate: settings.withdrawalFeeRate.toFixed(6),
    feeCoin: feeCoin.toFixed(2),
    netAmountTry: netAmountTry.toFixed(2),
    availableBalance: current.wallet!.availableBalance.toFixed(2),
    canWithdraw: current.wallet!.availableBalance.gte(amountCoin),
    simulation: true as const,
  };
}

export async function simulateWithdrawal(userId: string, input: WithdrawalSimulation) {
  const amountCoin = amountValue(input);
  const ibanMasked = maskIban(input.iban);
  const accountHolderName = normalizeHolderName(input.accountHolderName);
  return prisma.$transaction(async (tx) => {
    const initial = await findWalletContext(userId, tx);
    await lockWallet(initial.wallet!.id, tx);
    const current = await findWalletContext(userId, tx);
    const settings = await systemSettings(tx);
    const previous = await tx.walletTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { deposit: true, withdrawal: true },
    });
    if (previous) {
      validateIdempotentRequest(previous, current.wallet!.id, WalletTransactionType.WITHDRAWAL, amountCoin);
      return {
        wallet: walletFromCurrent({ wallet: current.wallet! }, settings),
        withdrawal: previous.withdrawal ? {
          id: previous.withdrawal.id,
          amountCoin: previous.withdrawal.amountCoin.toFixed(2),
          coinTryRate: previous.withdrawal.coinTryRate.toFixed(6),
          feeRate: previous.withdrawal.feeRate.toFixed(6),
          feeCoin: previous.withdrawal.feeCoin.toFixed(2),
          netAmountTry: previous.withdrawal.netAmountTry.toFixed(2),
          ibanMasked: previous.withdrawal.ibanMasked,
          accountHolderName: previous.withdrawal.accountHolderName,
          status: previous.withdrawal.status,
          createdAt: previous.withdrawal.createdAt.toISOString(),
        } : undefined,
        transaction: transactionOutput(previous),
        simulation: true as const,
      };
    }
    await assertLedgerConsistency(current.wallet!.id, current.wallet!.availableBalance, current.wallet!.heldBalance, tx);
    if (current.wallet!.availableBalance.lt(amountCoin)) {
      throw new AppError(400, "INSUFFICIENT_FUNDS", "Available balance is not sufficient.");
    }
    const feeCoin = roundMoney(amountCoin.mul(settings.withdrawalFeeRate));
    const netAmountTry = roundMoney(amountCoin.sub(feeCoin).mul(settings.coinTryRate));
    const availableAfter = current.wallet!.availableBalance.sub(amountCoin);
    const transactionId = randomUUID();
    const withdrawalId = randomUUID();
    const transaction = await tx.walletTransaction.create({
      data: {
        id: transactionId,
        walletId: current.wallet!.id,
        type: WalletTransactionType.WITHDRAWAL,
        amount: amountCoin,
        fee: feeCoin,
        idempotencyKey: input.idempotencyKey,
        availableBefore: current.wallet!.availableBalance,
        availableAfter,
        heldBefore: current.wallet!.heldBalance,
        heldAfter: current.wallet!.heldBalance,
        description: `Simulated withdrawal to ${ibanMasked}`,
      },
      include: { deposit: true, withdrawal: true },
    });
    await tx.withdrawal.create({
      data: {
        id: withdrawalId,
        walletId: current.wallet!.id,
        transactionId,
        amountCoin,
        coinTryRate: settings.coinTryRate,
        feeRate: settings.withdrawalFeeRate,
        feeCoin,
        netAmountTry,
        ibanMasked,
        accountHolderName,
        idempotencyKey: input.idempotencyKey,
      },
    });
    const updated = await tx.wallet.update({
      where: { id: current.wallet!.id },
      data: { availableBalance: availableAfter },
    });
    const created = await tx.walletTransaction.findUniqueOrThrow({
      where: { id: transaction.id },
      include: { deposit: true, withdrawal: true },
    });
    return {
      wallet: walletFromCurrent({ wallet: updated }, settings),
      withdrawal: {
        id: withdrawalId,
        amountCoin: amountCoin.toFixed(2),
        coinTryRate: settings.coinTryRate.toFixed(6),
        feeRate: settings.withdrawalFeeRate.toFixed(6),
        feeCoin: feeCoin.toFixed(2),
        netAmountTry: netAmountTry.toFixed(2),
        ibanMasked,
        accountHolderName,
        status: "COMPLETED" as const,
        createdAt: created.createdAt.toISOString(),
      },
      transaction: transactionOutput(created),
      simulation: true as const,
    };
  });
}

async function paginated<T>(page: number, limit: number, count: () => Promise<number>, findMany: (skip: number, take: number) => Promise<T[]>) {
  const safePage = page || 1;
  const safeLimit = limit || 20;
  const [total, items] = await Promise.all([count(), findMany((safePage - 1) * safeLimit, safeLimit)]);
  return {
    items,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
  };
}

export async function listTransactions(userId: string, query: WalletListQuery) {
  const wallet = await findWalletContext(userId);
  const where = { walletId: wallet.wallet!.id };
  return paginated(
    query.page ?? 1,
    query.limit ?? 20,
    () => prisma.walletTransaction.count({ where }),
    (skip, take) => prisma.walletTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { ledgerSequence: "desc" },
      include: { deposit: true, withdrawal: true },
    }).then((rows) => rows.map(transactionOutput)),
  );
}

export async function listDeposits(userId: string, query: WalletListQuery) {
  const wallet = await findWalletContext(userId);
  const where = { walletId: wallet.wallet!.id };
  return paginated(
    query.page ?? 1,
    query.limit ?? 20,
    () => prisma.deposit.count({ where }),
    (skip, take) => prisma.deposit.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }).then((rows) => rows.map((row) => ({
      id: row.id,
      amountTry: row.amountTry.toFixed(2),
      coinTryRate: row.coinTryRate.toFixed(6),
      coinAmount: row.coinAmount.toFixed(2),
      status: row.status,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt.toISOString(),
    }))),
  );
}

export async function listWithdrawals(userId: string, query: WalletListQuery) {
  const wallet = await findWalletContext(userId);
  const where = { walletId: wallet.wallet!.id };
  return paginated(
    query.page ?? 1,
    query.limit ?? 20,
    () => prisma.withdrawal.count({ where }),
    (skip, take) => prisma.withdrawal.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }).then((rows) => rows.map((row) => ({
      id: row.id,
      amountCoin: row.amountCoin.toFixed(2),
      coinTryRate: row.coinTryRate.toFixed(6),
      feeRate: row.feeRate.toFixed(6),
      feeCoin: row.feeCoin.toFixed(2),
      netAmountTry: row.netAmountTry.toFixed(2),
      ibanMasked: row.ibanMasked,
      accountHolderName: row.accountHolderName,
      status: row.status,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt.toISOString(),
    }))),
  );
}

export async function deposit(userId: string, input: WalletAmount) {
  const result = await simulateDeposit(userId, { amountTry: input.amount, idempotencyKey: input.idempotencyKey });
  return result.wallet;
}

export async function withdraw(userId: string, input: WalletAmount) {
  const result = await simulateWithdrawal(userId, {
    amountCoin: input.amount,
    iban: "TR000000000000000000000000",
    accountHolderName: "Legacy simulation",
    idempotencyKey: input.idempotencyKey,
  });
  return result.wallet;
}
