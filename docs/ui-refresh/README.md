# UI refresh notes

This refresh is intentionally kept on the local-only `codex/ui-refresh` branch until it is approved.

## Brand palette

The shared Tailwind color mapping lives at the top of `apps/web/src/index.css`.

| Role | Color |
| --- | --- |
| Primary ink | `#191102` |
| Navy section | `#0D2149` |
| Muted sage | `#758173` |
| Cream surface | `#FEF5EF` |
| Raspberry accent | `#912F56` |

Existing semantic Gray, Emerald, Blue, Red and Amber utilities are remapped there so every current page inherits the same five-color system without duplicating page-specific CSS.

## Homepage hero image

The generated hero is stored at:

`apps/web/src/assets/marketplace-hero.jpg`

It is imported near the top of `apps/web/src/pages/home-page.tsx`. To replace it later, either:

1. export a new landscape JPG with the same filename and overwrite that file; or
2. add a new image under `apps/web/src/assets/` and update the `heroImage` import.

Recommended crop: `16:9` or `16:10`, at least 1400 px wide, no text inside the image, and ideally below 500 KB.

## Shared layout

- Header and authenticated navigation: `apps/web/src/layouts/app-shell.tsx`
- Footer used by marketplace and authentication pages: `apps/web/src/layouts/site-footer.tsx`
- Homepage structure and Valorant most-purchased section: `apps/web/src/pages/home-page.tsx`
- The `popular` listing sort is implemented in the Listing API and orders listings by purchase/order activity.
