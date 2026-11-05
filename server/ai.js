import Anthropic from '@anthropic-ai/sdk';

/**
 * Optional AI reading of loan emails (closure letters, NOCs, sanction letters and emails the rules
 * couldn't read with confidence). Runs only when ANTHROPIC_API_KEY is set; otherwise the rule-based
 * parser's result stands. The model only reports what the email states; it never decides that a
 * loan is closed: the user confirms that in the app.
 */

const MODEL = 'claude-opus-5-5';
let client = null;

export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

const money = { type: ['number', 'null'], description: 'Rupees as a number, null if the email does not state it' };
const date = { type: ['string', 'null'], description: 'YYYY-MM-DD, null if not stated' };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_loan_email', 'purpose', 'lender', 'loan_account_last4', 'loan_type', 'emi', 'principal', 'outstanding', 'foreclosure_amount', 'interest_rate', 'tenure_months', 'due_date', 'disbursed_on', 'closure_date', 'confirms_full_repayment', 'notes'],
  properties: {
    is_loan_email: { type: 'boolean', description: 'False for marketing, offers, or emails not about an existing loan of the recipient' },
    purpose: { type: 'string', enum: ['sanction', 'disbursal', 'emi_paid', 'emi_due', 'statement', 'foreclosure_quote', 'closure', 'noc', 'other'] },
    lender: { type: ['string', 'null'] },
    loan_account_last4: { type: ['string', 'null'], description: 'Last 4 digits of the loan account/agreement number' },
    loan_type: { type: ['string', 'null'], enum: ['Personal loan', 'Home loan', 'Vehicle loan', 'Education loan', 'Gold loan', 'Consumer durable loan', 'Pay Later', 'Other loan', null] },
    emi: money,
    principal: { ...money, description: 'Original sanctioned or disbursed loan amount in rupees' },
    outstanding: { ...money, description: 'Outstanding principal as stated by the lender' },
    foreclosure_amount: money,
    interest_rate: { type: ['number', 'null'], description: 'Annual interest rate in percent' },
    tenure_months: { type: ['integer', 'null'] },
    due_date: date,
    disbursed_on: date,
    closure_date: date,
    confirms_full_repayment: { type: 'boolean', description: 'True only if the email explicitly states the loan is fully repaid/closed or certifies no dues' },
    notes: { type: ['string', 'null'], description: 'One short sentence on anything uncertain' },
  },
};

const rupees = (v) => (typeof v === 'number' && v > 0 ? Math.round(v * 100) : null);

export async function refineLoanEvent(event, email) {
  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system:
        'You read one email from an Indian lender and extract facts about the recipient\'s loan. Report only what the email states; use null for anything it does not state. Do not guess amounts or dates. Treat offers and pre-approved loan marketing as is_loan_email=false.',
      messages: [
        {
          role: 'user',
          content: `From: ${email.from}\nSubject: ${email.subject}\nDate received: ${email.date}\nAttachments: ${(email.attachments ?? []).join(', ') || 'none'}\n\n${String(email.body || email.snippet).slice(0, 12000)}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return event;
    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) return event;
    const x = JSON.parse(text);
    if (!x.is_loan_email) return null;
    return {
      ...event,
      purpose: x.purpose === 'other' ? event.purpose : x.purpose,
      lender: x.lender || event.lender,
      account: x.loan_account_last4 ? `XX${String(x.loan_account_last4).replace(/\D/g, '').slice(-4)}` : event.account,
      loanType: x.loan_type || event.loanType,
      emi: rupees(x.emi) ?? event.emi,
      principal: rupees(x.principal) ?? event.principal,
      outstanding: rupees(x.outstanding) ?? event.outstanding,
      foreclosureAmount: rupees(x.foreclosure_amount) ?? event.foreclosureAmount,
      rate: x.interest_rate ?? event.rate,
      tenureMonths: x.tenure_months ?? event.tenureMonths,
      dueDate: x.due_date ?? event.dueDate,
      disbursedOn: x.disbursed_on ?? event.disbursedOn,
      closureDate: x.closure_date ?? event.closureDate,
      confirmsFullRepayment: Boolean(x.confirms_full_repayment),
      aiNotes: x.notes ?? null,
      extractedBy: 'ai',
      confidence: Math.max(event.confidence, 0.8),
    };
  } catch (err) {
    console.error(`[recundle] AI extraction skipped: ${err?.status ?? ''} ${err?.name ?? 'error'}`);
    return event;
  }
}
