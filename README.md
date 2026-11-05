# Recundle

*Track. Bundle. Recundle.*

One place for your money and your responsibilities. Recundle answers four questions:

1. **Expenses**: where does my money come from, and where does it go?
2. **Subscriptions**: what am I paying for, and when does it renew?
3. **Loans**: what do I still owe, and how do I close it sooner?
4. **To-Dos**: which personal responsibilities are still pending?

A **Home** dashboard brings the four together.

## Where the data comes from

- **PhonePe statements in your Google Drive (the only automatic source).** Save your PhonePe statement PDFs in a Drive folder named **“Phone Pe - Monthly Statement”** (subfolders such as one per year are fine). Recundle reads every PDF in that folder, and nothing else in your Drive. Each row (date, payee, debit or credit, amount, transaction ID, UTR, account) becomes a transaction, keyed by its PhonePe transaction ID so nothing is counted twice.
  - New or changed files are read each time you open Recundle or press **Sync**; files already read are not downloaded again.
  - Password-protected statements open with the password you save in **Settings → PhonePe statements**. It is kept only in your browser and sent only while opening the PDFs.
  - A statement can also be added by hand under **Expenses → Add statement**.
  - Statements cover whole months, so Home and Expenses open on the latest month with statement data until the current month has some.
- **Gmail is not used.** Versions before November 2026 read Gmail; anything they stored from email is removed the first time this version opens.
- **CSV bank statements** can still be added; a payment that is also in a PhonePe statement is counted once.
- **You.** You can edit every field, add transactions, subscriptions and loans, and write your own to-dos.

PDFs are read in memory on the server and discarded; only the rows are kept, on your device.

## Where the data lives

On this device. Transactions, your edits, rules, subscriptions, loans and to-dos are saved in the browser's IndexedDB, under one record per Google account, and nothing is kept on Recundle's servers. Gmail is the only Google service Recundle uses.

- **Signing out keeps your data** for next time. **Settings → Delete all my Recundle data** removes it.
- **Back up or move your data:** use **Settings → Download a copy**.
- **Each browser has its own copy.** A new browser starts empty and reads the Drive folder again.

**Drive sync saves as it goes.** Statements are saved after every few files, so reloading mid-sync loses nothing, and later syncs read only new or changed files.

## Modules

### Expenses
- **Periods:** this month, previous month, last 3, 6 or 12 months, or a custom range.
- **Metrics:**
  - Total income and total expenses (net of refunds).
  - Net cash flow, money received and money spent.
  - Savings per month and average monthly spending.
  - Highest spending category.

  Every tile opens the transactions behind it.
- **Definitions:**
  - Transfers between your own accounts, credit card bill payments and investments are never counted as spending.
  - Refunds reduce expenses.
  - Reimbursements and loans received are kept apart from income.
- **Charts:**
  - Monthly income vs expenses, with unusual months flagged.
  - Spending by category as a donut. Clicking a category opens its transactions.
- **Where is my money going?** Observations, each linked to its transactions:
  - Category increases.
  - Many small payments adding up.
  - Recurring cost.
  - Possible duplicate charges.
  - Unusually large payments.
- **Transactions:** search (name, UPI ID, reference, notes) and filters (direction, category, type, "to check").
  - Each transaction shows where it came from (PhonePe statement, CSV statement or added by you).
  - The same payment in a PhonePe statement and a CSV statement is counted once.
- **Edit anything:**
  - Name, payee, type, category, subcategory, purpose, description and notes.
  - Link to a subscription or a loan.
  - Leave out of totals.
- **Learning from corrections:**
  - After you change a payee's category, type or name, Recundle asks whether to apply it only to this transaction or to all transactions from that payee, including future ones. The second choice saves a rule.
  - Similar-looking names (for example "R Kumar" for "Rahul Kumar") are listed for you to tick, never applied silently.
  - Your change to a single transaction always beats a rule.
  - Rules can be removed under **Expenses → Rules & categories**.
- **Payees:** top merchants, top people, most frequent and largest payments. Each opens the payee's full history.
- **Money in:**
  - Income, refunds, reimbursements, loans received and own transfers.
  - Top sources, with recurring income (such as salary) marked.
  - Money received from people.
- **Custom categories and subcategories.**

### Subscriptions
- **Found from your statements:**
  - Regular payments to the same payee. These start as **Needs verification** until you confirm them.
  - Payments you link yourself. For example, an Amazon charge that is really Amazon Prime, optionally only at that exact amount.
  - Subscriptions you add (for card or cash payments).
- **Statuses:** Active, Trial, Payment failed, Needs verification, Inactive and Cancelled.
  - You can change the status at any time.
  - Inactive and cancelled subscriptions keep their history but don't count towards monthly or annual cost.
- **Cards:**
  - Amount and billing cycle.
  - Next renewal, marked "estimated" unless stated.
  - Last payment and payment source.
- **Detail view:**
  - Complete payment history.
  - Price changes.
  - Editable name, amount, cycle, renewal and notes.
- **Insights:** most expensive subscription, price increases, overlapping services and upcoming renewals. Recundle never claims a service is unused; it can't see usage.

### Loans
- **Added by you** with the figures from your lender's statement or app. EMI payments in your PhonePe statements can be linked to a loan from the transaction.
- **Labelled figures.** Every figure says where it comes from:
  - **Entered by you**
  - **Estimated**: calculated by amortisation, and never shown as official.
  - **Not available**

  Use **Enter figures** to copy values from a statement.
- **Estimates when figures allow:**
  - Outstanding balance, rolled forward from the last stated balance.
  - Remaining EMIs and total still to pay.
  - Remaining interest and completion date.
  - Implied interest rate.
  - Foreclosure amount (using your charge %).
- **Closing a loan:** only your confirmation marks it **Closed**. Without an NOC on record it shows "NOC not identified — Loan closure status requires verification".
- **Repayment roadmap:**
  - Compares *highest interest first* with *smallest balance first* for an extra monthly amount and/or a one-time payment.
  - The EMIs of closed loans roll over to the next loan.
  - Shows which loan to close first and why, the amount needed, the EMI freed, interest saved, remaining loans and the next priority.
  - Loans missing a balance, EMI or rate are listed as excluded, with the reason.
- **"How far am I from being debt-free?"** Remaining debt, EMIs, debt-free date and a chart comparing EMIs only with your plan. Assumptions are stated on the page.

### To-Dos
- **Flashcards in Pending and Completed,** with counts. Tap a card to flip it. The back shows the status and actions: Mark completed, Keep pending, Edit and Delete (with confirmation).
- **Completed cards stay available** and can be reopened.
- **Categories:** Family, Healthcare, Personal documentation, Finance, Home, Administrative and Other. Dates are optional.

### Home
- This month's money in, money out, net cash flow and loans outstanding.
- Six-month income vs expenses chart.
- Commitments: subscriptions, EMIs, and renewals and EMIs due in the next 30 days.
- Loan progress, pending to-dos, and a few insights from real data.

## Security and privacy

- **Google sign-in:**
  - The code flow uses a popup, and the server exchanges the code.
  - Tokens are sealed with AES-256-GCM in an **HttpOnly** `SameSite=Lax` cookie scoped to `/api`. They are never stored in JavaScript.
  - The key is derived from `GOOGLE_WEB_CLIENT_SECRET` using HKDF, with salt `recription-session-v1`.
- **CSRF protection:** every API call must carry an `X-Recundle: 1` header. A cross-site page can't send it without a CORS preflight, which the server never allows.
- **Least privilege:**
  - `drive.readonly`: Recundle only reads; it can never change, move or delete a file. It lists and opens only the PDFs in the “Phone Pe - Monthly Statement” folder.
  - Basic profile.
  - No Gmail access.
- **No personal data in logs.** Server errors log only an error code.
- **Audit trail:** edits, rules, subscription and loan status changes, imports and deletions (Settings → Change history).
- **Your data, your control:** sign out (clears this device), disconnect Google (revokes access), download a JSON copy, or delete everything.

## Code

```
api/            Vercel functions (Web Request → Response)
  session.js    who is signed in; never returns tokens
  auth.js       Google code → sealed cookie
  logout.js     sign out / revoke
  drive.js      list / read the PhonePe statements in the Drive folder
  statement.js  read an uploaded PhonePe statement PDF
server/
  session.js    AES-GCM cookie sealing
  google.js     token refresh, Google API errors → app errors
  drive.js      find the statements folder (and subfolders), list and download PDFs
  phonepe.js    PDF text extraction (unpdf), password handling
src/
  core/         pure logic, unit-tested: store & merge, categories & built-in guesses,
                transactions (rules, duplicates), analytics, subscriptions, loans
                (amortisation, estimates, NOC matching, strategies), CSV statements,
                PhonePe statement layout → rows
  data/         AppData provider: session, on-device storage (IndexedDB), Drive sync, actions
  components/   UI kit, charts (Recharts), expenses components, app shell
  pages/        Landing, Dashboard, Expenses, Subscriptions, Loans, Todos, Settings
test/           node:test suites (all data made up)
```

**Stack:** React 19 with Vite, Tailwind CSS 4, framer-motion, Recharts and lucide icons, with Vercel Node functions on the server. There is no server database: data is stored in the user's browser.

**Palette:** Quantus 2025: Electric Violet `#834DFB`, Turbo `#F0E100`, Haiti `#18102B` and Blue Chalk `#F5F3FF`, used for the logo and favicon too. Chart colours are derived from it and validated for colour-blind readers.

**Design:** follows the Aoutive Framer template (aoutive.framer.website):
- Monochrome layout framed by thin rails and hairlines, with "+" marks where they cross.
- Square-cornered black and outlined buttons.
- Space Grotesk headings with a grey second line, and Inter for body text.
- A pixel-mosaic hero, line-drawn isometric illustrations, and bordered stats and access grids.
- An uppercase FAQ accordion.

Motion follows the template too:
- Headings fill in word by word as you scroll.
- A logo marquee, counting figures, flowing connector lines and a floating hero.
- Page transitions, and tiles that lift on hover.

Dark mode is supported.

**Logo:** the logo mark is a placeholder; the original artwork was lost with the old repository.

## Set up and run

### 1. Google Cloud (project `286940691052`, OAuth client `286940691052-ss6b2j3m1hfp69678ce04oburpmjunuf`)
- Enable the **Google Drive API**. The Gmail API is no longer used and can be disabled.
- Under **OAuth consent screen → Data access**, add the `…/auth/drive.readonly` scope and remove `gmail.readonly`.
  - `drive.readonly` is restricted: while the app is in Testing, add yourself as a test user (test-user access must be re-granted every 7 days).
  - A public launch needs Google verification and a security assessment.
- Under **Credentials → the Web client → Authorised JavaScript origins**, add the site address (for example `https://recundle.vercel.app`) and `http://localhost:5173` for development. No redirect URI is needed.

### 2. Environment variables (see `.env.example`)
- `GOOGLE_WEB_CLIENT_SECRET` (required): the Web client's secret.
- `GOOGLE_CLIENT_ID` (optional): set this if you use a different OAuth client.

### 3. Deploy to Vercel
- Import the repository (root directory `recundle/` if it stays inside another repo).
- The framework is detected as Vite.
- Add the variables above and deploy.

### 4. Local development
```sh
npm install
cp .env.example .env.local   # add the secret
npm run dev                  # http://localhost:5173 (API routes served by Vite)
npm test                     # 23 unit tests
```

## Limitations

- **Expenses are what PhonePe statements show.** Card payments, cash and other UPI apps are not counted unless you add them (manually or as a CSV statement).
- **Statement layout.** The reader follows PhonePe's Date | Transaction Details | Type | Amount table. If PhonePe changes the layout, rows may be skipped; Settings shows how many rows each statement gave.
- **Bank statements must be CSV.** Only PhonePe statements are read as PDF.
- **Loan figures are what you enter.** Estimates assume fixed rates and monthly EMIs.
- **Subscription usage is unknown,** so Recundle never calls a subscription unused.
- **Data stays in one browser.** It doesn't sync between devices; use the backup download to move it.
- **Classification rules match the payee name exactly,** with direction and optionally amount. Similar names need your confirmation.
