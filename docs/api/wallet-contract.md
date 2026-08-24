# Wallet API Contract

Wallet operations use the authenticated `gm_session` cookie and serialize all
money values as strings. Deposit and withdrawal are simulated in the MVP.

## `GET /wallet`

Returns the current wallet:

```json
{
  "data": {
    "availableBalance": "25.00",
    "heldBalance": "0.00",
    "currency": "COIN"
  }
}
```

## `POST /wallet/deposit`

Request (with a unique key per operation):

```json
{ "amount": "25.00", "idempotencyKey": "deposit-buyer-001" }
```

Returns `200` with the updated wallet. The balance update and transaction audit
record are created in one database transaction.

## `POST /wallet/withdraw`

Request (with a unique key per operation):

```json
{ "amount": "10.00", "idempotencyKey": "withdraw-buyer-001" }
```

Returns `200` with the updated wallet. The operation can only reduce
`availableBalance`; held funds cannot be withdrawn. A withdrawal larger than
the available balance returns `400 INSUFFICIENT_FUNDS` and changes nothing.

Amounts must be positive decimal strings with at most two fractional digits.
Unauthenticated requests return `401`.

Repeating a request with the same key and amount returns the original result
without changing the balance. Reusing a key with a different operation or
amount returns `409 IDEMPOTENCY_KEY_REUSED`.