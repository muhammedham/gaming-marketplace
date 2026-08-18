# Listings API Contract

This contract lets the Sprint 2 React and Fastify work proceed in parallel. The
web app uses the same types with a mock source until the API implementation is
ready. Set `VITE_LISTINGS_SOURCE=api` to use Fastify.

## Product Decisions

- UI language is English.
- A Seller-created listing becomes `ACTIVE` immediately in Sprint 2.
- A listing detail represents one listing, not multiple competing offers.
- Game is optional. Rank, server and region fields are out of scope.
- Cards return and display only the Cover. Gallery and Video are detail-only.
- Money values are serialized as decimal strings.

## Media Limits

| Role | Count | Types | Maximum size |
| --- | ---: | --- | ---: |
| Cover | 1 | JPEG, PNG, WebP | 5 MB |
| Gallery | 5 | JPEG, PNG, WebP | 5 MB each |
| Video | 1 | MP4, WebM | 25 MB |

The API regenerates file names, validates MIME and extension, and serves uploads
from an isolated public path.

## Public Endpoints

### `GET /categories`

Returns `{ "data": { "items": Category[] } }`.

### `GET /games`

Returns `{ "data": { "items": Game[] } }`.

### `GET /listings`

Supported query parameters:

- `q`: title search
- `category`: category slug
- `game`: game slug
- `minPrice`, `maxPrice`: decimal strings
- `sort`: `newest`, `price_asc`, or `price_desc`
- `page`: positive integer
- `limit`: 1-50

Returns active listings only:

```json
{
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 12, "total": 0, "totalPages": 0 }
  }
}
```

### `GET /listings/:listingId`

Returns one Listing detail with Cover, Gallery, optional Video and Seller
summary.

## Seller Endpoints

All Seller endpoints require the `gm_session` cookie and current `SELLER` role.

- `GET /listings/mine`: active and inactive listings owned by the session user.
- `POST /listings`: creates an active listing from Category, optional Game,
  title, description and price.
- `PATCH /listings/:listingId`: updates an owned listing.
- `POST /listings/:listingId/deactivate`: changes an owned listing to `INACTIVE`.
- `POST /listings/:listingId/media`: multipart upload with `role` equal to
  `COVER`, `GALLERY`, or `VIDEO` and one `file` part.

Another Seller receives `403 FORBIDDEN` for update, deactivate or media upload.

## Core Shapes

```ts
type ListingStatus = "ACTIVE" | "INACTIVE";
type MediaRole = "COVER" | "GALLERY" | "VIDEO";

interface ListingSummary {
  id: string;
  title: string;
  price: string;
  status: ListingStatus;
  category: { id: string; name: string; slug: string };
  game: { id: string; name: string; slug: string } | null;
  cover: { id: string; role: "COVER"; url: string; alt: string };
  seller: { id: string; name: string; joinedAt: string };
  createdAt: string;
  updatedAt: string;
}
```
