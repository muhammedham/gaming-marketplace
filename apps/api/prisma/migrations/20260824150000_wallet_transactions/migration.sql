-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "coin_try_rate" DECIMAL(18,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "system_settings_id_singleton" CHECK ("id" = 1),
    CONSTRAINT "system_settings_coin_try_rate_positive" CHECK ("coin_try_rate" > 0)
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "available_before" DECIMAL(18,2) NOT NULL,
    "available_after" DECIMAL(18,2) NOT NULL,
    "held_before" DECIMAL(18,2) NOT NULL,
    "held_after" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallet_transactions_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "wallet_transactions_fee_non_negative" CHECK ("fee" >= 0)
);

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");
CREATE UNIQUE INDEX "wallet_transactions_idempotency_key_key" ON "wallet_transactions"("idempotency_key");

-- Protect wallet invariants at the database boundary.
ALTER TABLE "wallets"
ADD CONSTRAINT "wallets_available_balance_non_negative" CHECK ("available_balance" >= 0),
ADD CONSTRAINT "wallets_held_balance_non_negative" CHECK ("held_balance" >= 0);

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;