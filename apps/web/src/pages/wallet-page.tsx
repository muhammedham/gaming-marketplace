import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, CircleHelp, Loader2, WalletCards } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  getWallet,
  listDeposits,
  listWalletTransactions,
  listWithdrawals,
  previewWithdrawal,
  simulateDeposit,
  simulateWithdrawal,
  walletKeys,
} from "../features/wallet/wallet-api";
import type { WithdrawalPreview } from "../features/wallet/types";
import { ApiError } from "../lib/api-client";
import { Link } from "react-router-dom";

function newIdempotencyKey(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function WalletPage() {
  const queryClient = useQueryClient();
  const walletQuery = useQuery({ queryKey: walletKeys.summary(), queryFn: getWallet, refetchInterval: 5000 });
  const transactionsQuery = useQuery({ queryKey: walletKeys.transactions(), queryFn: listWalletTransactions, refetchInterval: 5000 });
  const depositsQuery = useQuery({ queryKey: walletKeys.deposits(), queryFn: listDeposits });
  const withdrawalsQuery = useQuery({ queryKey: walletKeys.withdrawals(), queryFn: listWithdrawals });
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [iban, setIban] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [preview, setPreview] = useState<WithdrawalPreview | undefined>();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | undefined>();

  const refreshWallet = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: walletKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
    ]);
  };

  const depositMutation = useMutation({
    mutationFn: () => simulateDeposit({ amountTry: depositAmount, idempotencyKey: newIdempotencyKey("deposit") }),
    onSuccess: async (result) => {
      setDepositAmount("");
      setNotice({ kind: "success", message: `Deposit simulated: ${result.deposit.coinAmount} Coin added.` });
      await refreshWallet();
    },
    onError: (error) => setNotice({ kind: "error", message: errorMessage(error) }),
  });

  const previewMutation = useMutation({
    mutationFn: () => previewWithdrawal(withdrawAmount),
    onSuccess: (result) => {
      setPreview(result);
      setNotice(undefined);
    },
    onError: (error) => {
      setPreview(undefined);
      setNotice({ kind: "error", message: errorMessage(error) });
    },
  });

  const withdrawalMutation = useMutation({
    mutationFn: () => simulateWithdrawal({
      amountCoin: withdrawAmount,
      iban,
      accountHolderName,
      idempotencyKey: newIdempotencyKey("withdrawal"),
    }),
    onSuccess: async (result) => {
      setWithdrawAmount("");
      setIban("");
      setAccountHolderName("");
      setPreview(undefined);
      setNotice({ kind: "success", message: `Withdrawal simulated: ${result.withdrawal.netAmountTry} TRY net.` });
      await refreshWallet();
    },
    onError: (error) => setNotice({ kind: "error", message: errorMessage(error) }),
  });

  const handleDeposit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(undefined);
    depositMutation.mutate();
  };

  const handlePreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    previewMutation.mutate();
  };

  const handleWithdrawal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(undefined);
    withdrawalMutation.mutate();
  };

  if (walletQuery.isPending) {
    return <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-20"><Loader2 className="size-6 animate-spin" aria-label="Loading wallet" /></div>;
  }

  if (walletQuery.isError || !walletQuery.data) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-red-700">Unable to load your wallet.</div>;
  }

  const wallet = walletQuery.data;
  const transactions = transactionsQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Wallet</p>
          <h1 className="mt-2 text-3xl font-bold">Your Coin wallet</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">Manage your marketplace balance and review every ledger entry.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <CircleHelp className="size-4" aria-hidden="true" /> Simulation only — no real payment or bank transfer.
        </div>
      </div>

      {notice ? <div role="status" className={notice.kind === "success" ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"}>{notice.message}</div> : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Wallet balances">
        <div className="rounded-lg border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">Available</p><p className="mt-2 text-3xl font-bold">{wallet.availableBalance} <span className="text-base font-semibold">Coin</span></p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">Held</p><p className="mt-2 text-3xl font-bold">{wallet.heldBalance} <span className="text-base font-semibold">Coin</span></p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">Simulation rate</p><p className="mt-2 text-3xl font-bold">{wallet.coinTryRate} <span className="text-base font-semibold">TRY/Coin</span></p><p className="mt-1 text-xs text-gray-500">Withdrawal fee: {(Number(wallet.withdrawalFeeRate) * 100).toFixed(2)}%</p></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2" aria-label="Wallet simulations">
        <form className="space-y-4 rounded-lg border border-gray-200 bg-white p-5" onSubmit={handleDeposit}>
          <div className="flex items-center gap-2"><ArrowDownToLine className="size-5 text-emerald-700" aria-hidden="true" /><h2 className="text-lg font-semibold">Add balance (simulation)</h2></div>
          <p className="text-sm text-gray-600">Enter a TRY amount. It is converted using the current Coin rate.</p>
          <label className="block text-sm font-medium" htmlFor="deposit-amount">Amount (TRY)</label>
          <Input id="deposit-amount" inputMode="decimal" min="0.01" step="0.01" required value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="100.00" />
          <Button type="submit" disabled={depositMutation.isPending}>{depositMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}Simulate deposit</Button>
        </form>

        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2"><ArrowUpFromLine className="size-5 text-emerald-700" aria-hidden="true" /><h2 className="text-lg font-semibold">Withdraw (simulation)</h2></div>
          <p className="text-sm text-gray-600">Preview the fee and net TRY amount before submitting bank details.</p>
          <form className="space-y-4" onSubmit={handlePreview}>
            <div><label className="block text-sm font-medium" htmlFor="withdraw-amount">Amount (Coin)</label><Input id="withdraw-amount" inputMode="decimal" min="0.01" step="0.01" required value={withdrawAmount} onChange={(event) => { setWithdrawAmount(event.target.value); setPreview(undefined); }} placeholder="25.00" /></div>
            <Button type="submit" variant="secondary" disabled={previewMutation.isPending}>{previewMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}Preview withdrawal</Button>
          </form>
          {preview ? <div className="rounded-md bg-gray-50 p-3 text-sm"><div className="flex justify-between"><span>Fee</span><strong>{preview.feeCoin} Coin</strong></div><div className="mt-1 flex justify-between"><span>Net amount</span><strong>{preview.netAmountTry} TRY</strong></div><p className={preview.canWithdraw ? "mt-2 text-emerald-700" : "mt-2 text-red-700"}>{preview.canWithdraw ? "Balance is sufficient." : "Available balance is insufficient."}</p></div> : null}
          <form className="space-y-4 border-t border-gray-200 pt-4" onSubmit={handleWithdrawal}>
            <div><label className="block text-sm font-medium" htmlFor="iban">Turkish IBAN</label><Input id="iban" required value={iban} onChange={(event) => setIban(event.target.value)} placeholder="TR00 0000 0000 0000 0000 0000 00" /></div>
            <div><label className="block text-sm font-medium" htmlFor="account-holder">Account holder name</label><Input id="account-holder" required value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} placeholder="Name Surname" /></div>
            <Button type="submit" disabled={withdrawalMutation.isPending || !preview?.canWithdraw}>{withdrawalMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}Simulate withdrawal</Button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white" aria-labelledby="wallet-history">
        <div className="flex items-center gap-2 border-b border-gray-200 p-5"><WalletCards className="size-5 text-emerald-700" aria-hidden="true" /><h2 id="wallet-history" className="text-lg font-semibold">Transaction history</h2></div>
        {transactionsQuery.isPending ? <div className="p-5 text-sm text-gray-500">Loading transactions…</div> : transactionsQuery.isError ? <p className="p-5 text-sm text-red-700" role="alert">{transactionsQuery.error.message}</p> : transactions.length === 0 ? <div className="p-5 text-sm text-gray-500">No wallet transactions yet.</div> : <div className="divide-y divide-gray-100">{transactions.map((transaction) => <div className="flex flex-wrap items-center justify-between gap-3 p-5" key={transaction.id}><div><p className="font-medium">{transaction.description || transaction.type}</p><p className="mt-1 text-xs text-gray-500">{dateLabel(transaction.createdAt)} · {transaction.type}</p>{transaction.orderId && <Link className="mt-1 block text-xs text-emerald-700 underline" to={`/orders/${transaction.orderId}`}>View order</Link>}</div><div className="text-right"><p className="font-semibold">{["DEPOSIT", "SALE", "REFUND"].includes(transaction.type) ? "+" : transaction.type === "RELEASE" ? "" : "−"}{transaction.amount} Coin{transaction.type === "RELEASE" ? " released from Held" : ""}</p><p className="mt-1 text-xs text-gray-500">Available: {transaction.availableAfter} · Held: {transaction.heldAfter} Coin</p></div></div>)}</div>}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="deposit-history"><h2 id="deposit-history" className="font-semibold">Simulated deposits</h2><div className="mt-4 space-y-3">{depositsQuery.data?.items.length ? depositsQuery.data.items.map((deposit) => <div className="flex justify-between gap-3 text-sm" key={deposit.id}><span>{deposit.amountTry} TRY → {deposit.coinAmount} Coin</span><span className="text-gray-500">{dateLabel(deposit.createdAt)}</span></div>) : <p className="text-sm text-gray-500">No deposits yet.</p>}</div></section>
        <section className="rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="withdrawal-history"><h2 id="withdrawal-history" className="font-semibold">Simulated withdrawals</h2><div className="mt-4 space-y-3">{withdrawalsQuery.data?.items.length ? withdrawalsQuery.data.items.map((withdrawal) => <div className="flex justify-between gap-3 text-sm" key={withdrawal.id}><span>{withdrawal.amountCoin} Coin → {withdrawal.netAmountTry} TRY</span><span className="text-gray-500">{dateLabel(withdrawal.createdAt)}</span></div>) : <p className="text-sm text-gray-500">No withdrawals yet.</p>}</div></section>
      </div>
    </div>
  );
}
