# Wallet API Contract (Sprint 3)

Wallet operations use the authenticated `gm_session` cookie. All money values
are serialized as strings. Deposit and withdrawal are deliberately simulated:
there is no external payment provider or bank transfer.

## `GET /wallet`

Returns available/held Coin balances and the current simulation settings:

```json
{
  "data": {
    "availableBalance": "25.00",
    "heldBalance": "0.00",
    "currency": "COIN",
    "coinTryRate": "1.000000",
    "withdrawalFeeRate": "0.000000",
    "simulation": true
  }
}
```

## `POST /wallet/deposits/simulate`

`amountTry` is converted to Coin using `coinTryRate` (`Coin = TRY / rate`).
`idempotencyKey` is required and globally unique.

```json
{ "amountTry": "25.00", "idempotencyKey": "deposit-buyer-001" }
```

Returns `201` with the deposit detail, wallet snapshot and its explanatory
`WalletTransaction`. The detail and ledger row are committed atomically.

## `POST /wallet/withdrawals/preview`

Preview never mutates the wallet. It calculates the configured fee and net TRY
amount and reports whether the current available balance is sufficient:

```json
{ "amountCoin": "10.00" }
```

## `POST /wallet/withdrawals/simulate`

Creates a simulated withdrawal after validating the Turkish IBAN and account
holder name. Only the masked IBAN is stored.

```json
{
  "amountCoin": "10.00",
  "iban": "TR000000000000000000000000",
  "accountHolderName": "Name Surname",
  "idempotencyKey": "withdraw-buyer-001"
}
```

If the amount exceeds `availableBalance`, the endpoint returns `400
INSUFFICIENT_FUNDS` and does not create a withdrawal, transaction, or balance
change. Repeating a request with the same key and amount returns the original
result; reusing a key with a different operation or amount returns `409
IDEMPOTENCY_KEY_REUSED`.

## History endpoints

- `GET /wallet/transactions?page=1&limit=20` returns the append-only ledger and
  pagination metadata.
- `GET /wallet/deposits?page=1&limit=20` returns simulated deposit details.
- `GET /wallet/withdrawals?page=1&limit=20` returns simulated withdrawal details.

Every successful balance change has exactly one ledger record with before/after
snapshots and a human-readable description. Database checks prevent negative
balances and a trigger prevents updates to existing ledger rows. All state
changes execute inside a database transaction with a wallet row lock.

Legacy `POST /wallet/deposit` and `POST /wallet/withdraw` remain available for
backward compatibility and use the same simulation/ledger implementation.

## Sprint 4 order movements

Transaction history additionally includes `HOLD`, `RELEASE`, `SALE`, `REFUND` and
nullable `orderId`. HOLD moves buyer Available to Held; RELEASE removes buyer
Held; SALE credits seller Available; REFUND returns buyer Held to Available.
Completion produces two records in the same DB transaction. Deposit and withdrawal
remain available after any order movement because chain validation handles all six
transaction types. Each simulation now also writes an in-site wallet notification.
See [Orders/Support contract](orders-support-contract.md) for ownership and state rules.
