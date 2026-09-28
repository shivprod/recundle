# Recundle

*Track. Bundle. Recundle.*

Subscription tracker that finds your recurring payments by reading receipt emails in Gmail (read-only).

This repo began as an export of the Apper project `recription-tech-crowd` (the product was previously called Recription) on 2026-09-28.

## What's here

- **Backend: two Apper edge functions with the same code.**
  - `recundle` (`src/apper/metadata/edge-functions/recundle.js`) is the web app's backend. It requires an Apper sign-in, and the app calls it through `VITE_RECUNDLE`.
  - `recription-api` (`recription-api.js`) is kept for the Android app, which calls it without an Apper sign-in.
  - Both use the same secret and session key, so a Gmail session from one works with the other.
  - `POST {action}`:
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

## Gmail receipts

Onboarding is: Sign up / Sign in, then **Connect Gmail**, then the name step, then the dashboard. Sign-in with Google is Apper's social login, turned on in the Apper auth settings.

- **Connect Gmail** (`src/gmail/`, `/onboarding/gmail`):
  - Opens Google's consent popup for `gmail.readonly` using Google Identity Services (code flow, `ux_mode: popup`).
  - The code goes to the `recundle` function's `auth` action with `redirectUri: "postmessage"`.
  - The returned sealed session is kept on the device, and the first receipt scan starts straight away, while the user is on the name step.
- **Sync:**
  - The first scan fetches the newest 60 emails, then backfills older pages in the background (up to 10 pages).
  - Opening the dashboard runs an incremental sync (`since`) when the last sync is more than 10 minutes old.
- **Subscriptions** (`src/gmail/subscriptions.js`):
  - Receipts are grouped by merchant.
  - A merchant counts as a subscription when its receipts show a billing period, a renewal date or a free trial, or when it charges the same amount at a regular interval.
  - Lapsed plans and one-off orders are left out.
  - Failed payments from the last 30 days are shown first.
- **Disconnect** revokes the Google token and removes the receipts from the device.

### Setup needed for production

1. **Backend:** done on 2026-09-28. `recription-api` was redeployed with the web `redirectUri` change, and `recundle` was created. Still to do: port the `redirectUri` change to the TypeScript source (`server/apper/recription-api.ts`), and redeploy both functions whenever that source changes.
2. **Google Cloud Console, OAuth web client:** add every web origin that serves the app (for example the Apper preview and production domains) under *Authorized JavaScript origins*.
3. **Google Cloud Console, OAuth consent screen:** the app needs the `gmail.readonly` scope, which is a restricted scope.
   - While the app is in testing, add test users (up to 100). Their access expires after 7 days.
   - A public launch needs Google's verification and a security assessment, plus a privacy policy that meets Google's Limited Use requirements.

## Brand

This follows the Recundle brand identity guidelines.

- **Colours** (`src/theme.css`):
  - Primary Teal `#4DAAA7`, Secondary Teal `#3F8F8B` and Charcoal `#333333`.
  - Light-mode buttons and links use `#357A77`, a darker Secondary Teal tint, so white text stays readable (5.0:1 contrast).
  - Dark mode uses the charcoal palette with Primary Teal accents.
- **Typography:** Google Sans, weights 400 to 700, from Google Fonts.
- **Logo:** `src/components/RecundleLogo.jsx` has `RecundleMark` (the symbol) and `RecundleLogo` (the lockup), plus `public/favicon.svg` for the app icon.
  - The symbol is a vector trace of the guideline artwork. Swap in the official vector file when it's available.
  - The mark is full colour on light backgrounds and switches to monochrome reversed (white) in dark mode, as the guidelines require.

## Preferred name storage

The name is stored on the platform User record in the custom field `preferred_name_c` (via `sdk.admin.get/update('user', …)`), with a per-user copy in localStorage.

The `preferred_name_c` field (Text, optional) was added to the live User table on 2026-09-28. If a save to the server fails, the name is still kept on the device and a warning is logged in the console.

## Not included

- **Original TypeScript source.** The edge function is a bundled build of `server/apper/recription-api.ts`, `src/detection/*` and `src/domain/*`. Those source files and the Android app weren't in Apper and need adding separately.
- `.env` (see `.env.example`) and `public/favicon.ico`.

## Run the web app

```sh
cp .env.example .env   # fill in values from Apper
npm install
npm run dev
```
