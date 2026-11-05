# Recundle

*Track. Bundle. Recundle.*

One place for your money and your responsibilities. Recundle answers four questions:

1. **Expenses**: where does my money come from, and where does it go?
2. **Subscriptions**: what am I paying for, and when does it renew?
3. **Loans**: what do I still owe, and how do I close it sooner?
4. **To-Dos**: which personal responsibilities are still pending?

A **Home** dashboard brings the four together.

## Where the data comes from

- **Gmail (read-only).** Recundle reads the following emails and nothing else:
  - Bank and card alerts (UPI, NEFT, IMPS, card spends, credits).
  - Merchant receipts.
  - Subscription emails: renewals, trials, failed payments and cancellations.
  - Loan emails: sanction letters, disbursals, EMI receipts and reminders, statements, foreclosure quotes, closure letters and NOCs.

  Email bodies are read in memory on the server and discarded; only the parsed fields are kept.
- **Bank statements (CSV)** that you import. They add money received, UPI transfers and anything not emailed. Columns are found by name, and UPI, NEFT and card narrations are read for the payee.
- **You.** You can edit every field, add transactions, subscriptions and loans, and write your own to-dos.

Google Pay, PhonePe and banks don't offer other apps access to your transactions, so Recundle uses the alerts and receipts they email you, plus statements you import.

## Where the data lives

Your edits, rules, imported transactions, loans and to-dos are saved as one JSON file, `recundle-data.json`, in your own Google Drive app-data folder (scope `drive.appdata`):

- Only Recundle can read it.
- It doesn't appear in your Drive file list.
- You can remove it from Drive settings, or with **Settings → Delete all my Recundle data**.

Recundle's servers keep no copy. The browser keeps a cache for speed, and it is cleared when you sign out.

Two devices are merged record by record, and the newer edit wins. Deletions are kept as tombstones so they sync too.

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
  - Each transaction shows where it came from, with links to the original emails.
  - The same payment seen twice (bank alert plus receipt, or Gmail plus statement) is counted once.
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
- **Found from evidence:**
  - Receipts with a billing period or renewal date.
  - Subscription emails without a payment: trials, failed payments, cancellations and reminders.
  - Regular payments to the same payee. These start as **Needs verification**.
  - Payments you link yourself. For example, an Amazon charge that is really Amazon Prime, optionally only at that exact amount.
- **One receipt is not enough to call a subscription Active.** It needs a stated renewal date or a repeat payment on schedule.
- **Statuses:** Active, Trial, Payment failed, Needs verification, Inactive and Cancelled.
  - You can change the status at any time.
  - Inactive and cancelled subscriptions keep their history but don't count towards monthly or annual cost.
- **Cards:**
  - Amount and billing cycle.
  - Next renewal, marked "estimated" unless stated.
  - Last payment and payment source.
- **Detail view:**
  - Complete history with email links.
  - Price changes.
  - Editable name, amount, cycle, renewal and notes.
- **Insights:** most expensive subscription, price increases, overlapping services and upcoming renewals. Recundle never claims a service is unused; it can't see usage.

### Loans
- **Discovery:** Gmail loan emails are grouped by lender and loan account number. Promotions and pre-approved offers are ignored.
  - Discovered loans are offered for you to **Confirm** or mark **Not mine**.
  - Nothing counts until you confirm it.
- **Labelled figures.** Every figure says where it comes from:
  - **From lender email**
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
- **NOCs:**
  - NOC and closure emails are matched to a loan by lender and account number. A match by lender only is flagged.
  - The loan shows **NOC found**, with the email, closure date and attachment.
  - Only your confirmation marks it **Closed**.
  - A closure without an NOC shows "NOC not identified — Loan closure status requires verification".
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
  - `gmail.readonly`: Recundle can never send, delete or change email.
  - `drive.appdata`: only Recundle's own hidden folder.
  - Basic profile.
- **No personal data in logs.** Server errors log only an error code.
- **Audit trail:** edits, rules, subscription and loan status changes, imports and deletions (Settings → Change history).
- **Your data, your control:** sign out (clears this device), disconnect Google (revokes access), download a JSON copy, or delete everything.
- **Optional AI reading** (`ANTHROPIC_API_KEY`):
  - Closure letters, NOCs, sanction letters and unclear loan emails are sent to the Claude API (`claude-opus-5-5`) to extract stated figures. Only those emails are sent, with up to 4 per scan page.
  - Results are labelled "Read by AI".
  - The model never closes a loan; you do.

## Code

```
api/            Vercel functions (Web Request → Response)
  session.js    who is signed in; never returns tokens
  auth.js       Google code → sealed cookie
  logout.js     sign out / revoke
  gmail.js      one page of the Gmail scan (the browser pages through)
  data.js       read / write / delete the Drive data file (conflict-safe)
server/
  session.js    AES-GCM cookie sealing
  google.js     token refresh, Google API errors → app errors
  drive.js      Drive appDataFolder storage with version checks
  gmail.js      list + fetch + parse
  ai.js         optional Claude extraction for loan emails
  parse/        bank alerts, receipts & subscriptions, loans & NOCs, text helpers, lender list
src/
  core/         pure logic, unit-tested: store & merge, categories & built-in guesses,
                transactions (rules, duplicates), analytics, subscriptions, loans
                (amortisation, estimates, NOC matching, strategies), CSV statements
  data/         AppData provider: session, Drive sync, Gmail scan, actions
  components/   UI kit, charts (Recharts), expenses components, app shell
  pages/        Landing, Dashboard, Expenses, Subscriptions, Loans, Todos, Settings
test/           node:test suites (all data made up)
```

**Stack:** React 19 with Vite, Tailwind CSS 4, framer-motion, Recharts and lucide icons, with Vercel Node functions on the server. There is no database: storage is the user's Google Drive app folder.

**Brand:**
- Colours: Primary Teal `#4DAAA7`, Secondary Teal `#3F8F8B` and Charcoal `#333333`. Light-mode buttons use `#357A77` so white text stays readable.
- Font: Google Sans.
- Dark mode is supported.
- Chart colours are validated for colour-vision deficiency.

**Logo:** the logo mark is a placeholder; the original artwork was lost with the old repository.

## Set up and run

### 1. Google Cloud (project `286940691052`, OAuth client `286940691052-ss6b2j3m1hfp69678ce04oburpmjunuf`)
- Enable the **Gmail API** and the **Google Drive API**.
- Under **OAuth consent screen → Data access**, add the scopes `gmail.readonly` and `drive.appdata`.
  - `gmail.readonly` is restricted: while the app is in Testing, add yourself as a test user (test-user access must be re-granted every 7 days).
  - A public launch needs Google verification and a security assessment.
- Under **Credentials → the Web client → Authorised JavaScript origins**, add the site address (for example `https://recundle.vercel.app`) and `http://localhost:5173` for development. No redirect URI is needed.
- Raise **Gmail API → Quotas → Units per minute per user** if a first scan pauses often. The app waits and resumes on its own.

### 2. Environment variables (see `.env.example`)
- `GOOGLE_WEB_CLIENT_SECRET` (required): the Web client's secret.
- `GOOGLE_CLIENT_ID` (optional): set this if you use a different OAuth client.
- `ANTHROPIC_API_KEY` (optional): turns on AI reading of loan emails.

### 3. Deploy to Vercel
- Import the repository (root directory `recundle/` if it stays inside another repo).
- The framework is detected as Vite.
- Add the variables above and deploy.

### 4. Local development
```sh
npm install
cp .env.example .env.local   # add the secret
npm run dev                  # http://localhost:5173 (API routes served by Vite)
npm test                     # 30 unit tests
```

## Limitations

- **Gmail only shows what was emailed.** Banks that don't send alerts, cash, and UPI apps that don't email receipts need a statement import or a manual entry.
- **Statements must be CSV.** Excel and PDF statements aren't read; save Excel as CSV first.
- **Loan figures are what the emails state.** Rate, tenure or balance are often missing; enter them from a statement. Estimates assume fixed rates and monthly EMIs.
- **NOCs that exist only as PDF attachments are matched by subject and account, not by reading the PDF.** With AI reading on, the email text is read, but attachments still aren't.
- **Subscription usage is unknown,** so Recundle never calls a subscription unused.
- **The Drive data file must stay under about 4 MB** (Vercel's request limit), which is roughly 8,000 transactions.
- **Classification rules match the payee name exactly,** with direction and optionally amount. Similar names need your confirmation.
