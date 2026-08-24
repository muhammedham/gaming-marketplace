import { Static, Type } from "@sinclair/typebox";

const AmountSchema = Type.String({
  pattern: "^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,2})?$",
  maxLength: 19,
});

export const WalletAmountSchema = Type.Object({
  amount: AmountSchema,
  idempotencyKey: Type.String({ minLength: 8, maxLength: 100, pattern: "^[A-Za-z0-9._:-]+$" }),
});

export type WalletAmount = Static<typeof WalletAmountSchema>;