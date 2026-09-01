# Admin API contract

Base path: `/api/v1/admin`. Every route requires the HttpOnly session cookie and the current database role `ADMIN`. A stale token cannot keep Admin access after the role changes. Suspended accounts receive `403 ACCOUNT_SUSPENDED` on every protected route.

## Response and error rules

- Success: `{ "data": ... }`.
- Lists: `{ data: { items, pagination: { page, limit, total, totalPages } } }`.
- Validation: `400 VALIDATION_ERROR` with field details when available.
- Authentication/authorization: `401 UNAUTHENTICATED`, `403 FORBIDDEN`.
- State conflict: `409` with a stable code such as `LAST_ADMIN`, `ADMIN_SELF_PROTECTION`, `TAXONOMY_INACTIVE`, `INVALID_ORDER_STATE` or `SUPPORT_RESOLUTION_REQUIRED`.
- Every Admin mutation and its audit row commit in the same database transaction.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/session` | Admin role/session proof |
| GET | `/dashboard` | Counts, wallet totals, order status groups, recent ledger and audit activity |
| GET | `/users` | Search/filter/paginate users with wallet and activity summaries |
| PATCH | `/users/:id` | Change `role` and/or `status` |
| GET/POST | `/categories` | List or create categories |
| PATCH | `/categories/:id` | Edit or activate/deactivate a category |
| GET/POST | `/games` | List or create games |
| PATCH | `/games/:id` | Edit or activate/deactivate a game |
| GET | `/listings` | Search/filter/paginate every active or inactive listing |
| PATCH | `/listings/:id` | Set `ACTIVE` or `INACTIVE` |
| GET | `/orders` | Search/filter/paginate orders with buyer, seller, support and review summary |
| POST | `/orders/:id/action` | Audited `Complete` or `Cancel` action with a required note |
| GET | `/withdrawals` | Inspect simulation-only withdrawal records |
| GET | `/support` | Search/filter/paginate support records |
| GET/PATCH | `/settings` | Read/update Coin rate, withdrawal fee and new-order confirmation duration |
| GET | `/audit` | Search/paginate immutable Admin audit records |

List query parameters are `page`, `limit`, optional `q` and the resource-specific `status` or `role`. `limit` is restricted to 1-50.

## Safety rules

- An Admin cannot suspend itself or change its own role.
- The final active Admin cannot be suspended or demoted.
- Deactivating a Category or Game atomically makes its active listings inactive. Reactivation never silently republishes those listings.
- A listing cannot be activated while its Category or Game is inactive.
- Direct Admin completion is allowed only from `WaitingConfirmation`; direct cancellation is allowed only from `WaitingDelivery` or `WaitingConfirmation`.
- `SupportPaused` orders must be resolved from the linked Support Ticket, preserving the existing Resume/Complete/Cancel settlement rules.
- Settings affect future simulated operations and newly delivered orders. Existing ledger entries and deadlines are immutable.
- Deposit and Withdrawal are always simulation records. Admin responses never represent a real payment or bank transfer.

## Settings body

```json
{
  "coinTryRate": "1.000000",
  "withdrawalFeeRate": "0.000000",
  "autoConfirmationHours": "24.0000"
}
```

`coinTryRate` must be positive, `withdrawalFeeRate` must be between 0 and 1, and `autoConfirmationHours` must be between 0.001 and 168. Decimal strings are used to avoid floating-point money errors.

## Audit evidence

`AdminAuditLog` stores the Admin, action, entity type/id, JSON details and UTC time. User, taxonomy, listing, order and settings mutations create audit records in their own database transaction. Audit rows are readable but have no update/delete API.
