import { entityKey, looksLikePerson } from './entities.js';

/**
 * Transaction types decide how money counts:
 *  income        money you earned or were given (counts as income)
 *  expense       money you spent (counts as expenses)
 *  refund        money returned for something you bought (reduces expenses)
 *  reimbursement money paid back to you for something you covered (not income)
 *  borrowing     loan money received (not income)
 *  transfer      between your own accounts, card bill payments, investments (counted in neither)
 */
export const TYPES = {
  income: { label: 'Income', direction: 'in' },
  refund: { label: 'Refund', direction: 'in' },
  reimbursement: { label: 'Reimbursement', direction: 'in' },
  borrowing: { label: 'Loan received', direction: 'in' },
  expense: { label: 'Expense', direction: 'out' },
  transfer: { label: 'Own transfer', direction: 'both' },
};

export const BUILTIN_CATEGORIES = [
  { id: 'groceries', label: 'Groceries', icon: 'ShoppingBasket', kind: 'expense', subcategories: ['Supermarket', 'Quick commerce', 'Vegetables & fruit', 'Milk & daily'] },
  { id: 'food', label: 'Food & Dining', icon: 'UtensilsCrossed', kind: 'expense', subcategories: ['Food delivery', 'Restaurants', 'Cafes', 'Snacks'] },
  { id: 'shopping', label: 'Shopping', icon: 'ShoppingBag', kind: 'expense', subcategories: ['Online', 'Clothing', 'Electronics', 'Home'] },
  { id: 'rent', label: 'Rent', icon: 'House', kind: 'expense', subcategories: ['House rent', 'Maintenance', 'Deposit'] },
  { id: 'utilities', label: 'Utilities', icon: 'Zap', kind: 'expense', subcategories: ['Electricity', 'Mobile', 'Broadband', 'Water', 'Gas', 'DTH'] },
  { id: 'transport', label: 'Transportation', icon: 'Car', kind: 'expense', subcategories: ['Cab & auto', 'Fuel', 'Metro & bus', 'Parking & tolls'] },
  { id: 'healthcare', label: 'Healthcare', icon: 'HeartPulse', kind: 'expense', subcategories: ['Doctor', 'Medicines', 'Tests', 'Hospital'] },
  { id: 'travel', label: 'Travel', icon: 'Plane', kind: 'expense', subcategories: ['Flights', 'Trains', 'Hotels', 'Bus'] },
  { id: 'entertainment', label: 'Entertainment', icon: 'Clapperboard', kind: 'expense', subcategories: ['Streaming', 'Movies', 'Games', 'Events'] },
  { id: 'subscriptions', label: 'Subscriptions & software', icon: 'Repeat', kind: 'expense', subcategories: ['AI tools', 'Software', 'Cloud storage', 'Memberships'] },
  { id: 'education', label: 'Education', icon: 'GraduationCap', kind: 'expense', subcategories: ['Fees', 'Courses', 'Books'] },
  { id: 'personal_transfers', label: 'Personal Transfers', icon: 'Users', kind: 'expense', subcategories: ['Family', 'Friends', 'Household help'] },
  { id: 'emi', label: 'EMI & Loan Payments', icon: 'Landmark', kind: 'expense', subcategories: [] },
  { id: 'insurance', label: 'Insurance', icon: 'ShieldCheck', kind: 'expense', subcategories: ['Health', 'Life', 'Vehicle'] },
  { id: 'fees', label: 'Fees & charges', icon: 'Receipt', kind: 'expense', subcategories: ['Bank charges', 'Late fees', 'Taxes'] },
  { id: 'cash', label: 'Cash withdrawal', icon: 'Banknote', kind: 'expense', subcategories: [] },
  { id: 'investments', label: 'Savings & investments', icon: 'PiggyBank', kind: 'transfer', subcategories: ['Mutual funds', 'Stocks', 'Deposits'] },
  { id: 'card_bill', label: 'Credit card bill', icon: 'CreditCard', kind: 'transfer', subcategories: [] },
  { id: 'own_accounts', label: 'Between my accounts', icon: 'ArrowLeftRight', kind: 'transfer', subcategories: [] },
  { id: 'other', label: 'Other', icon: 'CircleDashed', kind: 'expense', subcategories: [] },
  { id: 'salary', label: 'Salary', icon: 'BriefcaseBusiness', kind: 'income', subcategories: [] },
  { id: 'business', label: 'Business & freelance', icon: 'Store', kind: 'income', subcategories: [] },
  { id: 'interest', label: 'Interest & dividends', icon: 'Percent', kind: 'income', subcategories: [] },
  { id: 'from_people', label: 'Received from people', icon: 'HandCoins', kind: 'income', subcategories: [] },
  { id: 'refunds', label: 'Refunds & cashback', icon: 'Undo2', kind: 'income', subcategories: [] },
  { id: 'reimbursements', label: 'Reimbursements', icon: 'ReceiptText', kind: 'income', subcategories: [] },
  { id: 'loan_received', label: 'Loan received', icon: 'Landmark', kind: 'income', subcategories: [] },
  { id: 'other_income', label: 'Other income', icon: 'CircleDashed', kind: 'income', subcategories: [] },
];

/** Built-in plus the user's own categories (stored with kind and optional parent). */
export function allCategories(custom = {}) {
  const extra = Object.values(custom).filter((c) => !c.deleted);
  const map = new Map(BUILTIN_CATEGORIES.map((c) => [c.id, { ...c, subcategories: [...c.subcategories] }]));
  for (const c of extra) {
    if (c.parent && map.has(c.parent)) {
      const parent = map.get(c.parent);
      if (!parent.subcategories.includes(c.label)) parent.subcategories.push(c.label);
    } else if (!c.parent) {
      map.set(c.id, { id: c.id, label: c.label, icon: c.icon || 'Tag', kind: c.kind || 'expense', subcategories: c.subcategories ?? [], custom: true });
    }
  }
  return [...map.values()];
}

const MERCHANTS = [
  ['food', 'Food delivery', /swiggy(?! instamart)|zomato|eatsure|box8|faasos|dominos?|pizza hut|mcdonald|kfc|burger king|subway/i],
  ['food', 'Cafes', /starbucks|third wave|blue tokai|chaayos|cafe coffee day|\bccd\b/i],
  ['groceries', 'Quick commerce', /blinkit|zepto|instamart|bigbasket|bb ?now|dunzo|jiomart|dmart|more retail|reliance fresh|nature'?s basket/i],
  ['shopping', 'Online', /amazon(?! prime| pay later)|flipkart|myntra|ajio|nykaa|meesho|tata ?cliq|croma|reliance digital|ikea|decathlon|lenskart|firstcry/i],
  ['transport', 'Cab & auto', /\buber\b|\bola\b|rapido|blu ?smart|namma yatri/i],
  ['transport', 'Fuel', /indian ?oil|\biocl?\b|bharat petroleum|\bbpcl\b|hpcl|hindustan petroleum|\bshell\b|petrol|fuel/i],
  ['transport', 'Parking & tolls', /fastag|toll|parking/i],
  ['transport', 'Metro & bus', /metro|\bbmtc\b|\bbest\b bus|\bdtc\b/i],
  ['travel', 'Flights', /indigo|air ?india|vistara|akasa|spicejet|makemytrip|goibibo|cleartrip|easemytrip|ixigo/i],
  ['travel', 'Trains', /irctc/i],
  ['travel', 'Hotels', /oyo|airbnb|booking\.com|agoda|taj hotels|marriott/i],
  ['travel', 'Bus', /redbus|abhibus/i],
  ['utilities', 'Mobile', /\bjio\b|airtel|vodafone|\bvi\b|bsnl/i],
  ['utilities', 'Electricity', /electricity|bescom|tata power|adani electricity|msedcl|tneb|bses|cesc|power distribution/i],
  ['utilities', 'Broadband', /act fibernet|hathway|excitel|broadband|you broadband|tikona/i],
  ['utilities', 'Gas', /\bgas\b|indane|bharat gas|hp gas|mahanagar gas|igl\b/i],
  ['utilities', 'DTH', /tata ?play|dish ?tv|d2h|sun direct/i],
  ['utilities', 'Water', /water (board|supply)|bwssb|jal board/i],
  ['healthcare', 'Medicines', /pharmeasy|netmeds|\b1mg\b|apollo pharmacy|medplus|pharmacy|chemist/i],
  ['healthcare', 'Doctor', /practo|hospital|clinic|apollo|fortis|manipal|max healthcare|dr\.? /i],
  ['healthcare', 'Tests', /thyrocare|lal path|metropolis|healthians|redcliffe/i],
  ['entertainment', 'Streaming', /netflix|prime video|hotstar|jiocinema|sonyliv|zee5|spotify|youtube|apple music|gaana|wynk|audible/i],
  ['entertainment', 'Movies', /bookmyshow|pvr|inox|cinepolis|district by zomato/i],
  ['entertainment', 'Games', /steam|playstation|xbox|google play games/i],
  ['subscriptions', 'AI tools', /openai|chatgpt|anthropic|claude|cursor|perplexity|midjourney|github copilot/i],
  ['subscriptions', 'Software', /notion|canva|adobe|microsoft|github|figma|zoom|slack|linkedin premium/i],
  ['subscriptions', 'Cloud storage', /google one|icloud|dropbox/i],
  ['subscriptions', 'Memberships', /amazon prime|swiggy one|zomato gold|times prime|cult\.?fit|curefit/i],
  ['education', 'Courses', /coursera|udemy|unacademy|byju|upgrad|skillshare|masterclass|duolingo|vedantu/i],
  ['insurance', 'Health', /star health|niva bupa|care health|hdfc ergo|icici lombard|bajaj allianz|policybazaar|\blic\b|insurance|premium/i],
  ['investments', 'Mutual funds', /zerodha|groww|kuvera|coin by zerodha|paytm money|upstox|mutual fund|\bsip\b|indmoney|smallcase|angel one/i],
  ['investments', 'Deposits', /fixed deposit|\bfd\b|recurring deposit|\brd\b|\bppf\b|\bnps\b/i],
  ['fees', 'Bank charges', /charges|\bfee\b|penalty|gst on|annual fee/i],
];

/**
 * Recundle's own guess for a transaction, used until the user or one of their rules says otherwise.
 * Returns { category, subcategory, type, confidence, reason }.
 */
export function guessCategory(raw, ctx = {}) {
  const name = raw.counterparty ?? '';
  const hay = `${name} ${raw.vpa ?? ''} ${raw.description ?? ''}`;
  const own = ctx.ownNames?.some((n) => n && entityKey(name) === n);

  if (raw.direction === 'in') {
    if (raw.loanHint?.disbursal) return { category: 'loan_received', type: 'borrowing', confidence: 0.8, reason: 'Loan disbursal email' };
    if (own || /\bself\b|own account|sweep/i.test(hay)) return { category: 'own_accounts', type: 'transfer', confidence: 0.75, reason: 'Transfer from your own account' };
    if (/refund|reversal|reversed|cashback|chargeback/i.test(hay)) return { category: 'refunds', type: 'refund', confidence: 0.8, reason: 'Refund or reversal' };
    if (/salary|\bsal\b|payroll|stipend/i.test(hay)) return { category: 'salary', type: 'income', confidence: 0.85, reason: 'Salary credit' };
    if (/interest|dividend|\bint\.? pd\b/i.test(hay)) return { category: 'interest', type: 'income', confidence: 0.8, reason: 'Interest or dividend' };
    if (/reimburse/i.test(hay)) return { category: 'reimbursements', type: 'reimbursement', confidence: 0.8, reason: 'Reimbursement' };
    if (looksLikePerson(name)) return { category: 'from_people', type: 'income', confidence: 0.45, reason: 'From a person' };
    if (/\b(pvt|ltd|limited|llp|technologies|solutions)\b/i.test(name) && raw.amount >= 1_000_000 && /neft|imps|rtgs/i.test(raw.method ?? '')) {
      return { category: 'salary', type: 'income', confidence: 0.5, reason: 'Large bank transfer from a company' };
    }
    return { category: 'other_income', type: 'income', confidence: 0.3, reason: 'No match' };
  }

  if (own) return { category: 'own_accounts', type: 'transfer', confidence: 0.75, reason: 'Transfer to your own account' };
  if (raw.loanHint || /\bemi\b|\bloan\b|\bnach\b/i.test(hay)) return { category: 'emi', type: 'expense', confidence: raw.loanHint ? 0.85 : 0.6, reason: 'Loan repayment' };
  if (/credit card (bill|payment)|card ?payment|\bcred\b(?!it)|cc bill|billdesk.*card/i.test(hay)) return { category: 'card_bill', type: 'transfer', confidence: 0.7, reason: 'Credit card bill payment' };
  if (raw.method === 'ATM' || /atm|cash withdrawal/i.test(hay)) return { category: 'cash', type: 'expense', confidence: 0.85, reason: 'Cash withdrawal' };
  if (raw.subscription?.isSubscription && raw.subscription?.known) {
    const hit = MERCHANTS.find(([, , re]) => re.test(name));
    return { category: hit?.[0] ?? 'subscriptions', subcategory: hit?.[1] ?? null, type: 'expense', confidence: 0.85, reason: 'Subscription receipt' };
  }
  if (/\brent\b/i.test(hay)) return { category: 'rent', subcategory: 'House rent', type: 'expense', confidence: 0.7, reason: 'Mentions rent' };
  for (const [category, subcategory, re] of MERCHANTS) {
    if (re.test(hay)) {
      const { kind } = BUILTIN_CATEGORIES.find((c) => c.id === category);
      return { category, subcategory, type: kind === 'transfer' ? 'transfer' : 'expense', confidence: re.test(name) ? 0.8 : 0.6, reason: 'Known merchant' };
    }
  }
  if (looksLikePerson(name)) return { category: 'personal_transfers', type: 'expense', confidence: 0.45, reason: 'Paid to a person' };
  return { category: 'other', type: 'expense', confidence: 0.25, reason: 'No match' };
}
