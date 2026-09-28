# Recundle

*Track. Bundle. Recundle.*

Subscription tracker that finds your recurring payments by reading receipt emails in Gmail (read-only).

This repo began as an export of the Apper project `recription-tech-crowd` (the product was previously called Recription) on 2026-09-28.

## What's here

- `src/apper/metadata/edge-functions/recription-api.js` is the backend (Apper edge function `recription-api`), which the Android app calls. `POST {action}`:
  - `auth` swaps the phone's Google `serverAuthCode` for tokens, checks the `gmail.readonly` scope, and returns an AES-GCM-sealed session. The server is stateless.
  - `me` returns the signed-in user.
  - `receipts` searches Gmail for receipts from about 39 known senders plus generic receipt subjects, and parses the merchant, amount, tax, billing period, renewal and trial dates, and payment instrument. It pages back through up to 2 years of history.
  - `revoke` revokes the Google refresh token.
  - It needs the Apper secret `GOOGLE_WEB_CLIENT_SECRET`.
- Web app (React 19, Vite, Tailwind 4, shadcn/ui on the Apper scaffold):
  - `StartupSplash` plays a short brand intro on launch.
  - `/` is the Welcome screen (Sign up / Sign in, using Apper's built-in auth).
  - `/onboarding/name` asks "What should we call you?" the first time only.
  - `/dashboard` is the main screen, with a personalised greeting.
- `src/personalization/` is the reusable personalization layer:
  - `usePreferredName()`: the signed-in user's name, loaded once and shared.
  - `getPersonalizedGreeting()`, `getGreeting()`, `getTimeOfDayGreeting()`, `addressUser()`: greeting and copy helpers.
  - `getUserName()`: the name for non-React code.

## Preferred name storage

The name is stored on the platform User record in the custom field `preferred_name_c` (via `sdk.admin.get/update('user', …)`), with a per-user copy in localStorage.

**The live Apper database needs this field.** Add a Text field `preferred_name_c` to the User table. Until then, names are kept on the device only (saving logs a warning in the console).

## Not included

- **Original TypeScript source.** The edge function is a bundled build of `server/apper/recription-api.ts`, `src/detection/*` and `src/domain/*`. Those source files and the Android app weren't in Apper and need adding separately.
- `.env` (see `.env.example`) and `public/favicon.ico`.

## Run the web app

```sh
cp .env.example .env   # fill in values from Apper
npm install
npm run dev
```
