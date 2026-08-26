import { Static, Type } from "@sinclair/typebox";

const AmountSchema = Type.String({
  pattern: "^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,2})?$",
  maxLength: 19,
});

const IdempotencyKeySchema = Type.String({
  minLength: 8,
  maxLength: 100,
  pattern: "^[A-Za-z0-9._:-]+$",
});

export const WalletAmountSchema = Type.Object({
  amount: AmountSchema,
  idempotencyKey: IdempotencyKeySchema,
});

export const DepositSimulationSchema = Type.Object({
  amountTry: AmountSchema,
  idempotencyKey: IdempotencyKeySchema,
});

export const WithdrawalAmountSchema = Type.Object({
  amountCoin: AmountSchema,
});

export const WithdrawalSimulationSchema = Type.Object({
  amountCoin: AmountSchema,
  iban: Type.String({ minLength: 26, maxLength: 34 }),
  accountHolderName: Type.String({ minLength: 2, maxLength: 100 }),
  idempotencyKey: IdempotencyKeySchema,
});

export const WalletListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
});

export type WalletAmount = Static<typeof WalletAmountSchema>;
export type DepositSimulation = Static<typeof DepositSimulationSchema>;
export type WithdrawalAmount = Static<typeof WithdrawalAmountSchema>;
export type WithdrawalSimulation = Static<typeof WithdrawalSimulationSchema>;
export type WalletListQuery = Static<typeof WalletListQuerySchema>;
