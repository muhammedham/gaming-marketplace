-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('COMPLETED');

-- Extend the single source of truth for financial simulation settings.
ALTER TABLE "system_settings"
ADD COLUMN "withdrawal_fee_rate" DECIMAL(9,6) NOT NULL DEFAULT 0,
ADD CONSTRAINT "system_settings_withdrawal_fee_rate_valid" CHECK ("withdrawal_fee_rate" >= 0 AND "withdrawal_fee_rate" <= 1);

-- Every ledger row carries a human-readable immutable explanation.
ALTER TABLE "wallet_transactions"
ADD COLUMN "description" VARCHAR(255) NOT NULL DEFAULT '';

-- A database sequence gives the append-only ledger a stable insertion order,
-- even when several operations share the same millisecond timestamp.
ALTER TABLE "wallet_transactions"
ADD COLUMN "ledger_sequence" SERIAL NOT NULL;
CREATE UNIQUE INDEX "wallet_transactions_ledger_sequence_key" ON "wallet_transactions"("ledger_sequence");
CREATE INDEX "wallet_transactions_wallet_id_ledger_sequence_idx" ON "wallet_transactions"("wallet_id", "ledger_sequence");
DROP INDEX "wallet_transactions_wallet_id_created_at_idx";

-- CreateTable
CREATE TABLE "deposits" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "amount_try" DECIMAL(18,2) NOT NULL,
    "coin_try_rate" DECIMAL(18,6) NOT NULL,
    "coin_amount" DECIMAL(18,2) NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deposits_amount_try_positive" CHECK ("amount_try" > 0),
    CONSTRAINT "deposits_coin_try_rate_positive" CHECK ("coin_try_rate" > 0),
    CONSTRAINT "deposits_coin_amount_positive" CHECK ("coin_amount" > 0)
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "amount_coin" DECIMAL(18,2) NOT NULL,
    "coin_try_rate" DECIMAL(18,6) NOT NULL,
    "fee_rate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "fee_coin" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount_try" DECIMAL(18,2) NOT NULL,
    "iban_masked" VARCHAR(32) NOT NULL,
    "account_holder_name" VARCHAR(100) NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "withdrawals_amount_coin_positive" CHECK ("amount_coin" > 0),
    CONSTRAINT "withdrawals_coin_try_rate_positive" CHECK ("coin_try_rate" > 0),
    CONSTRAINT "withdrawals_fee_rate_valid" CHECK ("fee_rate" >= 0 AND "fee_rate" <= 1),
    CONSTRAINT "withdrawals_fee_non_negative" CHECK ("fee_coin" >= 0),
    CONSTRAINT "withdrawals_net_amount_try_non_negative" CHECK ("net_amount_try" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "deposits_transaction_id_key" ON "deposits"("transaction_id");
CREATE UNIQUE INDEX "deposits_idempotency_key_key" ON "deposits"("idempotency_key");
CREATE INDEX "deposits_wallet_id_created_at_idx" ON "deposits"("wallet_id", "created_at");
CREATE UNIQUE INDEX "withdrawals_transaction_id_key" ON "withdrawals"("transaction_id");
CREATE UNIQUE INDEX "withdrawals_idempotency_key_key" ON "withdrawals"("idempotency_key");
CREATE INDEX "withdrawals_wallet_id_created_at_idx" ON "withdrawals"("wallet_id", "created_at");

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "wallet_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "wallet_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ledger rows are append-only. Deleting a user/wallet remains possible through
-- the existing cascade, but an individual financial record cannot be rewritten.
CREATE OR REPLACE FUNCTION prevent_wallet_transaction_update() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'wallet transaction rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_transactions_immutable
BEFORE UPDATE ON "wallet_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_wallet_transaction_update();
