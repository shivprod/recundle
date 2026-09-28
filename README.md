# Recription

Subscription tracker that finds your recurring payments by reading receipt emails in Gmail (read-only).

This repo is a backup of the Apper project `recription-tech-crowd`, exported on 2026-09-28.

## What's here

- `src/apper/metadata/edge-functions/recription-api.js` is the backend (Apper edge function `recription-api`), which the Android app calls. `POST {action}`:
  - `auth` swaps the phone's Google `serverAuthCode` for tokens, checks the `gmail.readonly` scope, and returns an AES-GCM-sealed session. The server is stateless.
  - `me` returns the signed-in user.
  - `receipts` searches Gmail for receipts from about 39 known senders plus generic receipt subjects, and parses the merchant, amount, tax, billing period, renewal and trial dates, and payment instrument. It pages back through up to 2 years of history.
  - `revoke` revokes the Google refresh token.
  - It needs the Apper secret `GOOGLE_WEB_CLIENT_SECRET`.
- Everything else is the Apper web-app scaffold (React 19, Vite, Tailwind 4, shadcn/ui). No Recription screens have been built yet.

## Not included

- **Original TypeScript source.** The edge function is a bundled build of `server/apper/recription-api.ts`, `src/detection/*` and `src/domain/*`. Those source files and the Android app weren't in Apper and need adding separately.
- `.env` (see `.env.example`) and `public/favicon.ico`.

## Run the web app

```sh
cp .env.example .env   # fill in values from Apper
npm install
npm run dev
```
