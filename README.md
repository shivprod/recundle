# Recundle

*Track. Bundle. Recundle.*

A web app that finds your subscriptions by reading the receipt emails in your Gmail (read-only).

It runs on Vercel: a React site plus one serverless function. It doesn't use Apper any more. The project began as an export of the Apper project `recription-tech-crowd` (the product was previously called Recription).

## How it works

1. **Landing page and sign-in** (`/`). It covers the hero, a receipt-to-subscription demo, how it works, the supported services, privacy promises, an FAQ and a closing call to action.
   - **Continue with Google** asks for the profile and read-only Gmail access (`gmail.readonly`) in one step.
   - The hero is a "renewal clock" (`RenewalOrbit`): a month dial with each subscription on its renewal day. A hand sweeps round, and each renewal pulses as it passes while the month's total counts up. It speeds up while the first page of receipts is read. The visitor then goes to the dashboard.
   - Signed-in visitors see the same page with **Open dashboard**. They're only redirected automatically right after a fresh sign-in.
2. **Dashboard** (`/dashboard`). This is a wide, responsive layout that also works on phones:
   - Stat tiles for monthly spend, yearly projection, subscriptions, renewals this week and free trials. The count tiles filter the list.
   - A searchable, filterable and sortable subscription list. Each row opens a detail panel with price, monthly and yearly cost, next renewal, last paid, payment method and payment history.
   - "Where it goes" (monthly cost per subscription), the next 30 days of renewals, and an account and sync card.
3. **Sign out** revokes Google access and removes the session, receipts and name from the device.

Other landing motion (`src/components/landing/Motifs.jsx`): a drifting backdrop behind the hero, a scan line reading the demo receipt, a stepper track in How it works, a Gmail permissions card, cycling renewal reminders beside the FAQ, and radar rings behind the closing call to action.

The header logo always links to `/`. Motion uses framer-motion and respects the "reduce motion" setting. Light, dark and system themes are supported.

There are no Recundle accounts or passwords, and no database. The Google sign-in is the account. The sealed session and the parsed receipts are kept in the browser (localStorage), one account per browser.

## Code

- **`api/recundle.js`** is the backend, a Vercel function. It takes `POST /api/recundle` with `{ action }`:
  - `auth` exchanges Google's one-time code (`redirectUri: "postmessage"`) for tokens. It checks that `gmail.readonly` was granted and returns an AES-GCM-sealed session. The server is stateless.
  - `me` returns the signed-in user.
  - `receipts` searches Gmail for receipts from about 39 known senders plus generic receipt subjects. It parses the merchant, amount, tax, billing period, renewal and trial dates, and the payment method, and pages back through up to 2 years.
  - `revoke` revokes the Google refresh token.
  - It needs one environment variable, `GOOGLE_WEB_CLIENT_SECRET`. The same value also keys the sealed sessions, so changing it signs everyone out.
- **`src/gmail/`**:
  - `googleCodeClient.js`: the Google Identity Services popup.
  - `gmailStore.js`: the session, receipt sync, and background backfill of up to 10 pages of 30 emails.
  - `useGmail.js`: the React hook.
  - `subscriptions.js`: turns receipts into subscriptions.
- **`src/personalization/`**: the preferred name (Google first name by default) and greeting helpers.
- **`src/pages/`**: `Welcome.jsx` (`/`, the landing page and sign-in) and `Dashboard.jsx` (`/dashboard`). Pages register themselves with `export const route`.
- **`src/components/landing/`** holds the landing page sections. **`src/components/dashboard/`** holds the stat tiles, list, detail panel, spend breakdown, renewal timeline and account card.
- **`src/gmail/subscriptions.js`** (`deriveSubscriptions`) groups receipts by merchant into subscriptions. Each subscription has monthly and yearly cost and its payment `history`.
- **`landing/index.html`**: the original standalone marketing page. Its content now lives in the app at `/`.

## Deploy (Vercel)

1. Import this GitHub repo as a Vercel project. The framework is detected as Vite, and `vercel.json` sets the SPA rewrites and the function timeout.
2. In the Vercel project's environment variables, add `GOOGLE_WEB_CLIENT_SECRET`: the client secret of the Google OAuth *Web application* client `86235899973-st5it9v5gaajo3q2qv0jt84n2i7ar2jt`.
3. In Google Cloud (APIs & Services → Credentials → the web client), add the Vercel address (for example `https://recundle.vercel.app`) under **Authorized JavaScript origins**. No redirect URI is needed, because the popup code flow uses `postmessage`.
4. **OAuth consent screen:** `gmail.readonly` is a restricted scope.
   - While the app is in testing, add test users (up to 100). Their access expires after 7 days.
   - A public launch needs Google's verification and a security assessment, plus a privacy policy that meets Google's Limited Use requirements.

## Run locally

```sh
npm install
npx vercel dev   # serves the site and /api/recundle together
```

`npm run dev` (Vite only) serves the site without the backend. Add `http://localhost:3000` to the Google client's JavaScript origins for local sign-in.

## Android

The Android app talks to the Apper function `recription-api`, which is still deployed there. The Android app's code isn't in this repo. Moving it off Apper means pointing it at `https://<your-vercel-domain>/api/recundle`. The `auth` action already accepts the Android `serverAuthCode`.

## Brand

This follows the Recundle brand identity guidelines.

- **Colours** (`src/theme.css`):
  - Primary Teal `#4DAAA7`, Secondary Teal `#3F8F8B` and Charcoal `#333333`.
  - Light-mode buttons and links use `#357A77`, so white text stays readable (5.0:1 contrast).
  - Dark mode uses the charcoal palette with Primary Teal accents.
- **Typography:** Google Sans, weights 400 to 700, from Google Fonts.
- **Logo:** `src/components/RecundleLogo.jsx` (`RecundleMark` and the `RecundleLogo` lockup) and `public/favicon.svg`.
  - The symbol is a vector trace of the guideline artwork. Swap in the official vector file when it's available.
  - In dark mode the mark switches to monochrome reversed (white).
- **Prime Video** isn't in Simple Icons, so its tile is a plain text tile in Prime's blue. Check each brand's guidelines before a public launch.

## Not included

The original TypeScript source of the backend (`server/apper/recription-api.ts`, `src/detection/*` and `src/domain/*`) and the Android app. `api/recundle.js` is the bundled build of that source.
