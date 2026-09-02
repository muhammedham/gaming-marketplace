# Valorant Inventory Analysis Contract

This optional Seller flow is available only when a listing uses the `accounts`
category and the `valorant` game. Listing publication never depends on the
analyzer: the Seller can skip the page and return later from Edit listing.

## Security and storage

- The Admin saves the external inference API base URL through `/admin/integrations/games`.
  An API key is optional under the current public contract. If one is configured,
  it is encrypted with AES-256-GCM using `INTEGRATION_ENCRYPTION_KEY` and sent as
  a Bearer token; it is never returned by any endpoint.
- Cloudflare R2 credentials remain in the API environment. They are not stored in
  PostgreSQL and are not entered in the Admin dashboard.
- The R2 bucket must remain private. The browser receives one-object, expiring PUT
  URLs and the inference service receives a separate expiring GET URL.
- Only MP4 and WebM are accepted. The maximum inventory video size is 150 MiB
  (`157286400` bytes). The API verifies the uploaded R2 object size and type with
  `HeadObject` before queueing inference.
- A BullMQ cleanup job deletes the temporary object 120 minutes after the upload
  session is created. PostgreSQL is the durable schedule, so overdue cleanup is
  reconciled after API/Redis restarts. The analysis result remains in PostgreSQL.

## Admin endpoints

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/admin/integrations/games` | Admin | Lists games and masked integration state |
| `PATCH /api/v1/admin/integrations/games/:gameId` | Admin | Saves the API base URL, optionally rotates an API key, and enables/disables analysis |

PATCH body:

```json
{
  "baseUrl": "https://screw-popular-triumph-div.trycloudflare.com",
  "apiKey": "only-required-when-setting-or-rotating",
  "enabled": true
}
```

The response contains only `apiKeyConfigured` and a last-four hint. Every update
creates a `GAME_INFERENCE_INTEGRATION_UPDATED` Admin audit record without the key.
The migration from the previous RunPod adapter disables and clears its incompatible
endpoint and credential, so an Admin must save the new base URL once.

## Seller endpoints

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/inventory-analyses/listings/:listingId` | Owner Seller | Eligibility, limits, service readiness and latest analysis |
| `POST /api/v1/inventory-analyses/upload-url` | Owner Seller | Creates an analysis and returns an expiring R2 PUT URL |
| `POST /api/v1/inventory-analyses/:id/complete-upload` | Owner Seller | Verifies the object and queues inference |
| `GET /api/v1/inventory-analyses/:id` | Owner Seller | Reads status and the stored raw provider result |

Analysis states are `AWAITING_UPLOAD`, `QUEUED`, `PROCESSING`, `COMPLETED`,
`FAILED`, and `EXPIRED`.

The worker starts an asynchronous inference:

```http
POST {baseUrl}/api/v1/external/inference
Content-Type: application/json
```

```json
{
  "game": "valorant",
  "media": "temporary-r2-get-url",
  "mediaType": "video"
}
```

The provider returns HTTP 202 with an inference ID. The worker polls
`GET {baseUrl}/api/v1/external/inference/{inferenceId}` every three seconds and
stores the ID in `provider_job_id`, so a restarted worker resumes the same job.
There is no overall analysis timeout. Polling continues until the provider returns
`completed`, `failed`, or `cancelled`; the marketplace never cancels a job because
of elapsed time.

Completed and failed status responses are stored unchanged in `raw_response`.
A completed response's `result` member is stored separately in `output` for the UI:

```json
{
  "id": "provider-inference-uuid",
  "status": "completed",
  "result": {
    "frames": []
  }
}
```

The Seller UI reads only detections whose `name` is `title`. It treats the last
word of `text` as the weapon and all preceding words as the skin, removes
case-insensitive duplicates across every frame, and groups skins by weapon. Known
Valorant weapon names use conservative fuzzy matching to merge small OCR errors
such as `CUARDIAN` into `Guardian`. The raw provider response remains available in
a collapsed diagnostic panel, while the cleaned grouped list has its own copy button.

## Local R2 CORS

The private bucket needs this browser-upload policy during local development:

```json
[
  {
    "AllowedOrigins": ["http://127.0.0.1:5173", "http://localhost:5173"],
    "AllowedMethods": ["PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add the production frontend origin later; do not make the bucket public.
