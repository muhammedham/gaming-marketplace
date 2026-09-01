# Sprint 5 final delivery

Dates: 2-5 September 2026. Starting point: `codex/sprint-3-wallet` / `3039793`, plus the complete local Sprint 4 implementation. Requirements: Sprint 5 PDF and the revised final design report.

## Muhammed and Zeyad completion matrix

| Work item | Result | Evidence |
| --- | --- | --- |
| Muhammed #22 Admin UI | Dashboard plus Users, Categories, Games, Listings, Orders, Withdrawals, Support and Settings routes | `AdminPage`, role-protected router and Admin navigation |
| Muhammed #23 responsive/state QA | Horizontal-safe tables, mobile navigation, loading/empty/error/success feedback and confirmation for mutations | Admin UI tests and browser screenshots |
| Zeyad #24 Admin API/RBAC | All Admin list/mutation endpoints, validation, transactional settlement and audit log | Admin service/routes, migration and Admin integration tests |
| Zeyad #25 seed/reset/Docker/Postman | Idempotent final seed, explicit destructive reset command, reusable setup/demo commands, Compose health checks and final collection | `seed.ts`, package scripts, `.env.example`, Compose and Postman files |
| Muhammed #26 final acceptance | Completed branch plus SupportPaused branch and Admin inspection | `npm run demo:final`, automated tests and manual browser QA |
| Zeyad #27 delivery package | Clean schema/container verification, documentation, screenshots and known-medium list | this document and `docs/final` |

The GitHub issue bodies were used as requirements references. The checkboxes on remote issues were not modified by the local implementation.

## Clean setup

```powershell
Copy-Item .env.example .env
npm install
npm run setup:final
npm run dev
```

`setup:final` starts PostgreSQL/Redis, deploys every migration, generates Prisma Client and runs the idempotent final seed. Health: `http://127.0.0.1:4000/health`; Web: `http://127.0.0.1:5173`.

`npm run db:reset` is intentionally separate because it permanently clears the configured database schema before migrations and seed. Never run it against an environment containing data you need. Normal updates use `npm run db:deploy` and preserve data.

`docker-compose.clean.yml` is the isolated final-install QA stack (PostgreSQL `55433`, Redis `56380`). It has separate project volumes and is never used by the normal development commands.

## Demo accounts and repeatable data

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@gaming.local` | `Admin123!` |
| Buyer | `buyer@gaming.local` | `Buyer123!` |
| Seller | `seller@gaming.local` | `Seller123!` |

`npm run db:seed` creates/updates the accounts, active taxonomy, system settings, a media-backed **Final Demo - Valorant Starter Loadout** listing and one idempotent 1,000 TRY simulated Buyer deposit. It does not reset unrelated data.

`npm run demo:final` reruns the seed, then exercises the APIs and leaves:

- a normal `Completed` 40 Coin order with a 5-star review;
- a second 40 Coin `SupportPaused` order with funds still Held;
- a 5 Coin simulated withdrawal;
- Admin-created demo Category and Game;
- Dashboard evidence for Orders, Wallet ledger, Withdrawal and Support.

The command is idempotent. On a clean database it produces the same two scenario branches. Deposit and Withdrawal are simulation only; no real payment or bank transfer occurs.

## Manual final demo

1. Login as Admin, open `/admin`, create a Category and Game, and inspect the Dashboard.
2. Login as Seller and publish a listing with Cover plus optional gallery/video media.
3. Login as Buyer, use **Simulate deposit**, open the listing and Buy Now.
4. Seller opens Sales Orders and marks delivery. Buyer confirms and leaves one review.
5. Buy the listing again and open a linked ticket before the deadline; verify `SupportPaused`.
6. Login as Admin. Inspect `/admin/orders`, the wallet ledger on Dashboard, `/admin/withdrawals` and `/admin/support`.
7. Open the support ticket and use Resume, Complete or Cancel as the chosen demo resolution. Use a separate order for each alternative.

## Automated evidence

```powershell
npm run verify
```

- API: 35 tests, including 4 new Sprint 5 Admin/RBAC/transaction/settings/demo-data tests.
- Web: 15 tests, including Buyer rejection from Admin routes and Admin Dashboard rendering.
- Existing Wallet, Listings, Order concurrency, real Redis/BullMQ delay, SupportPaused and immutable-ledger tests remain active.
- API tests deploy migrations and seed only in PostgreSQL schema `gaming_marketplace_test`; public demo/user data is not modified.

## Admin behavior delivered

- Dashboard: operational counts, Order statuses, Available/Held totals, simulated withdrawal totals, recent append-only ledger and Admin audit.
- Users: search/status filtering, role/status management, self and final-Admin protection.
- Categories/Games: create, search, status management and atomic active-listing hide on deactivation.
- Listings: search/status filtering, inspection and controlled activation/deactivation.
- Orders: inspection plus reasoned, audited Complete/Cancel only from safe states.
- Withdrawals: masked bank preview with unambiguous Simulation labeling.
- Support: search/status filtering and links to the existing reply/status/Resume/Complete/Cancel desk.
- Settings: Coin/TRY, withdrawal fee and new-delivery auto-confirm duration with Decimal/range validation.

## Documentation changed

1. Root `README.md`: final setup, Admin, demo, reset safety and verification commands.
2. `docs/api/admin-contract.md`: endpoints, request rules, errors, transactions and audit guarantees.
3. Main Postman collection/environment: final MVP name and complete Admin folder/variables.
4. This file: person/issue mapping, clean setup, demo, test evidence and delivered behavior.
5. `docs/final/report-comparison.md`: design-report claim versus implementation evidence and explicit deviations.
6. `docs/final/known-medium.md`: non-blocking technical/product limitations after feature freeze.
7. `docs/final/screenshots/`: desktop and mobile final demo evidence.

## Browser QA evidence

- `admin-dashboard-desktop.png`: Admin counts, order states, wallet totals, audit and ledger.
- `admin-withdrawals-simulation.png`: masked IBAN plus explicit simulation-only warning.
- `admin-support-mobile.png`: responsive 375 px Support table with no document overflow.
- `buyer-completed-order.png`: Completed order, timeline and submitted review.
- `buyer-support-paused-order.png`: SupportPaused order with funds visibly protected in Held.
- `seller-listings-final-demo.png`: media-backed final demo listing and Seller status controls.

The browser console was checked after the Buyer, Seller and Admin flows; no warnings or errors remained.
