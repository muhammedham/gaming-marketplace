# Listings API Contract

This contract keeps the Sprint 2 React and Fastify implementations aligned. The
web app uses the same types with either a mock or the implemented Fastify
source. `VITE_LISTINGS_SOURCE=api` is the clean-install default.

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

The API regenerates file names, validates MIME, extension, binary signature,
size, count and listing ownership, and serves uploads only from the isolated
`/uploads/` public path. `MEDIA_PUBLIC_URL` controls the absolute URL returned
to the web app.

## Public Endpoints

### `GET /categories`

Returns `{ "data": { "items": Category[] } }`.

### `GET /games`

Returns `{ "data": { "items": Game[] } }`.

### `GET /listings`

Supported query parameters:

- `q`: case-insensitive title and description search
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
summary. An inactive listing returns `404` unless its Seller owns the current
`gm_session`.

## Seller Endpoints

All Seller endpoints require the `gm_session` cookie and current `SELLER` role.

- `GET /listings/mine`: active and inactive listings owned by the session user.
- `POST /listings`: creates an active listing and all initial media atomically
  from multipart fields. Exactly one Cover is required.
- `PATCH /listings/:listingId`: updates an owned listing.
- `POST /listings/:listingId/deactivate`: changes an owned listing to `INACTIVE`.
- `POST /listings/:listingId/media`: multipart upload with `role` equal to
  `COVER`, `GALLERY`, or `VIDEO` and one `file` part.

Another Seller receives `403 FORBIDDEN` for update, deactivate or media upload.

### Create Listing multipart fields

| Field | Kind | Required | Rule |
| --- | --- | --- | --- |
| `categoryId` | text | yes | Existing Category UUID |
| `gameId` | text | no | Existing Game UUID or empty |
| `title` | text | yes | 3-160 characters after trimming |
| `description` | text | yes | 20-5000 characters after trimming |
| `price` | text | yes | Positive decimal string, max 2 decimals |
| `cover` | file | yes | Exactly one image |
| `gallery` | file | no | Repeat field up to 5 images |
| `video` | file | no | At most one video |

The API writes files under a generated `listings/{listingId}/{uuid}.{ext}` key.
If validation or database creation fails, moved files are removed and no partial
Listing remains.

### Update Listing JSON body

```json
{
  "categoryId": "0a217e9e-096b-48f4-8339-64c8d8389f85",
  "gameId": null,
  "title": "Example listing",
  "description": "A complete marketplace listing description.",
  "price": "100.00"
}
```

### Standard errors

| Status | Code | Meaning |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid fields or trimmed values |
| 400 | `INVALID_CATEGORY` / `INVALID_GAME` | Referenced taxonomy does not exist |
| 403 | `FORBIDDEN` | Current Seller does not own the listing |
| 404 | `LISTING_NOT_FOUND` | Listing is missing or inactive for this viewer |
| 409 | `GALLERY_LIMIT_REACHED` | The listing already has 5 gallery images |
| 413 | `MEDIA_TOO_LARGE` | Role-specific upload limit exceeded |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | MIME is not allowed for the role |
| 415 | `INVALID_MEDIA_EXTENSION` | Extension and MIME do not agree |
| 415 | `INVALID_MEDIA_CONTENT` | Binary signature and MIME do not agree |

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
