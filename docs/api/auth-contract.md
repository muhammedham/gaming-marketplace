# Auth API Contract

This contract is shared by the React client and the Fastify API for Sprint 1.

## Base URL

`http://localhost:4000/api/v1`

The web client reads the value from `VITE_API_URL` and sends cookies with every request.

## Session

- Cookie name: `gm_session`
- HttpOnly: `true`
- SameSite: `Lax`
- Secure: `true` in production
- Path: `/`
- The API must enable credentialed CORS for the configured web origin.

## Roles

- `BUYER`
- `SELLER`
- `ADMIN`

Public registration accepts only `BUYER` or `SELLER`. Admin users are created by seed or an Admin-only operation.

## Success Envelope

```json
{
  "data": {}
}
```

Auth session payload:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "name": "Demo Buyer",
      "email": "buyer@example.com",
      "role": "BUYER"
    },
    "wallet": {
      "availableBalance": "0.00",
      "heldBalance": "0.00",
      "currency": "COIN"
    }
  }
}
```

Decimal balances are serialized as strings to avoid floating-point loss.

## Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": {
      "email": ["Enter a valid email address."]
    }
  }
}
```

Expected status codes: `400` validation, `401` unauthenticated, `403` forbidden, `409` duplicate email, and `500` internal error.

## Endpoints

### `POST /auth/register`

```json
{
  "name": "Demo Buyer",
  "email": "buyer@example.com",
  "password": "minimum-eight-characters",
  "role": "BUYER"
}
```

Returns `201` with the auth session payload and creates the session cookie. User and zero-balance Wallet creation must share one database transaction.

### `POST /auth/login`

```json
{
  "email": "buyer@example.com",
  "password": "minimum-eight-characters"
}
```

Returns `200` with the auth session payload and creates the session cookie.

### `POST /auth/logout`

Returns `204` and clears the session cookie.

### `GET /auth/me`

Returns `200` with the current auth session payload, or `401` when no valid session exists.

### `GET /admin/session`

Returns `200` for `ADMIN`, `401` without a session, and `403` for authenticated Buyer or Seller users. This endpoint provides the Sprint 1 role-boundary acceptance proof without implementing the Sprint 5 Admin feature set.
