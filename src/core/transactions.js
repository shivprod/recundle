import { allCategories, guessCategory } from './categories.js';
import { entityKey, looksLikePerson, similarity } from './entities.js';
import { daysBetween } from './format.js';
import { live } from './store.js';

/**
 * Turns stored records into the transactions the app shows. For every field the precedence is:
 *   1. what the user set on this transaction
 *   2. the user's classification rule for this payee
 *   3. Recundle's own guess (with a confidence)
 * Duplicates (the same payment in a PhonePe statement and a CSV bank statement)
 * are folded into one transaction so nothing is counted twice.
 */

const SOURCE_RANK = { phonepe: 0, statement: 1, manual: 2 };
const STATEMENT_KINDS = new Set(['phonepe', 'statement']);
/** Where transactions come from: PhonePe statements in Drive, CSV statements you add, and your own entries. */
const SOURCES = new Set(['phonepe', 'statement', 'manual']);
const sourceKind = (t) => (t.source === 'gmail' ? t.raw.source : t.source);

/** The rule (if any) that applies to a raw transaction. */
export function matchRule(raw, key, rules) {
  return rules.find((r) => !r.deleted && r.keys.includes(key) && (!r.direction || r.direction === raw.direction) && (r.amount == null || r.amount === raw.amount)) ?? null;
}

/** Finds pairs that are one payment seen twice. Returns Map(duplicateId → primaryId). */
export function findDuplicates(records) {
  const byAmount = new Map();
  for (const t of records) {
    if (t.user?.notDuplicate) continue;
    const k = `${t.raw.direction}|${t.raw.amount}`;
    byAmount.set(k, [...(byAmount.get(k) ?? []), t]);
  }
  const dupes = new Map();
  for (const group of byAmount.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => (SOURCE_RANK[sourceKind(a)] ?? 9) - (SOURCE_RANK[sourceKind(b)] ?? 9) || a.raw.date.localeCompare(b.raw.date));
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      if (dupes.has(a.id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        const b = group[j];
        if (dupes.has(b.id)) continue;
        const gap = Math.abs(daysBetween(a.raw.date, b.raw.date));
        if (gap > 3) continue;
        const sameRef = a.raw.reference && b.raw.reference && a.raw.reference === b.raw.reference;
        const kindA = sourceKind(a);
        const kindB = sourceKind(b);
        const ka = entityKey(a.raw.counterparty);
        const kb = entityKey(b.raw.counterparty);
        const similar = similarity(ka, kb) >= 0.5 || !ka || !kb;
        // Same message source twice needs a matching reference; across sources a close name or date match is enough.
        const isDup = sameRef || (kindA !== kindB && (similar || (gap <= 1 && (STATEMENT_KINDS.has(kindA) || STATEMENT_KINDS.has(kindB)))));
        if (isDup) dupes.set(b.id, a.id);
      }
    }
  }
  return dupes;
}

/** Display name for the payee: the user's, a rule's, or the statement's text. */
function pickName(t, rule) {
  return t.user?.counterparty ?? rule?.set?.counterparty ?? t.raw.counterparty ?? t.raw.vpa ?? (t.raw.description ? t.raw.description.slice(0, 40) : null) ?? 'Unknown payee';
}

/** Transactions from PhonePe statements, CSV statements and manual entries. Anything else stored by older versions is ignored. */
export function buildTransactions(store, { ownNames = [] } = {}) {
  const records = live(store.txns).filter((t) => t.raw?.amount > 0 && t.raw?.date && SOURCES.has(sourceKind(t)));
  const rules = live(store.rules);
  const dupes = findDuplicates(records);
  const partners = new Map();
  for (const [dup, primary] of dupes) partners.set(primary, [...(partners.get(primary) ?? []), dup]);
  const byId = new Map(records.map((t) => [t.id, t]));
  const categories = allCategories(store.categories);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const own = ownNames.map(entityKey).filter(Boolean);

  const out = [];
  for (const t of records) {
    if (dupes.has(t.id)) continue;
    const linked = (partners.get(t.id) ?? []).map((id) => byId.get(id));
    const raw = { ...t.raw, subscription: t.raw.subscription ?? null, loanHint: t.raw.loanHint ?? null };
    const key = entityKey(t.user?.counterparty ?? raw.counterparty ?? raw.vpa ?? '');
    const rawKey = entityKey(raw.counterparty ?? raw.vpa ?? '');
    const rule = matchRule(raw, rawKey, rules) ?? (key !== rawKey ? matchRule(raw, key, rules) : null);
    const guess = guessCategory(raw, { ownNames: own });
    const u = t.user ?? {};
    const pick = (field) => (u[field] !== undefined ? 'user' : rule?.set?.[field] !== undefined ? 'rule' : 'auto');
    const value = (field, auto) => (u[field] !== undefined ? u[field] : rule?.set?.[field] !== undefined ? rule.set[field] : auto);
    const category = value('category', guess.category);
    const classifiedBy = pick('category') === 'user' || pick('type') === 'user' ? 'user' : rule ? 'rule' : 'auto';
    const counterparty = pickName(t, rule);
    const type = value('type', guess.type);
    out.push({
      id: t.id,
      date: u.date ?? raw.date,
      amount: raw.amount,
      direction: raw.direction,
      type,
      category: catById.has(category) ? category : 'other',
      subcategory: value('subcategory', guess.subcategory ?? null),
      counterparty,
      entityKey: entityKey(counterparty) || rawKey,
      isPerson: looksLikePerson(counterparty),
      name: u.name ?? counterparty,
      description: u.description ?? raw.description ?? '',
      notes: u.notes ?? '',
      purpose: value('purpose', ''),
      method: raw.method ?? null,
      account: raw.account ?? null,
      institution: raw.institution ?? null,
      reference: raw.reference ?? null,
      vpa: raw.vpa ?? null,
      source: sourceKind(t),
      sources: [t, ...linked].map((x) => ({ id: x.id, kind: sourceKind(x), messageId: x.raw.messageId ?? null, subject: x.raw.subject ?? x.raw.description ?? null })),
      subscription: raw.subscription,
      subscriptionKey: u.subscription !== undefined ? u.subscription : (rule?.set?.subscription ?? null),
      loanHint: raw.loanHint,
      loanId: u.loanId ?? null,
      classifiedBy,
      ruleId: rule?.id ?? null,
      confidence: classifiedBy === 'user' ? 1 : rule ? 0.95 : guess.confidence,
      reason: classifiedBy === 'user' ? 'You set this' : rule ? `Your rule for ${rule.label ?? counterparty}` : guess.reason,
      excluded: Boolean(u.excluded),
      matched: linked.length > 0,
      rawCounterparty: raw.counterparty ?? null,
      rawKey,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.amount - a.amount));
}

/** Transactions that count toward totals: not excluded by the user. */
export const counted = (txns) => txns.filter((t) => !t.excluded);

/** Other payees whose names are close to this one: offered for confirmation when a rule is made, never applied silently. */
export function similarPayees(txns, key, direction) {
  const groups = new Map();
  for (const t of txns) {
    if (t.direction !== direction || !t.rawKey || t.rawKey === key) continue;
    const s = similarity(key, t.rawKey);
    if (s < 0.5) continue;
    const g = groups.get(t.rawKey) ?? { key: t.rawKey, name: t.rawCounterparty ?? t.counterparty, count: 0, total: 0, score: s };
    g.count += 1;
    g.total += t.amount;
    groups.set(t.rawKey, g);
  }
  return [...groups.values()].sort((a, b) => b.score - a.score || b.count - a.count).slice(0, 6);
}

export const matchingCount = (txns, keys, direction) => txns.filter((t) => keys.includes(t.rawKey) && t.direction === direction).length;
