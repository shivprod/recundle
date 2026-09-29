import { formatLocalDate } from '@/utils/date';

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Renews in 3 days", "Trial ends tomorrow", "Payment failed 2 Oct". */
export function renewalText(sub) {
  const d = sub.daysUntilRenewal;
  const date = sub.nextRenewal ? formatLocalDate(sub.nextRenewal, 'd MMM') : null;
  if (sub.status === 'failed') {
    return `Payment failed ${formatLocalDate(sub.failedOn, 'd MMM')}`;
  }
  if (sub.status === 'trial') {
    if (d === 0) return 'Trial ends today';
    if (d === 1) return 'Trial ends tomorrow';
    return d <= 7 ? `Trial ends in ${d} days` : `Trial ends ${date}`;
  }
  if (!date) return null;
  const prefix = sub.estimated ? 'Likely renews' : 'Renews';
  if (d < 0) return `${prefix} ${date}`;
  if (d === 0) return `${prefix} today`;
  if (d === 1) return `${prefix} tomorrow`;
  return d <= 7 ? `${prefix} in ${d} days` : `${prefix} ${date}`;
}

export const isThisWeek = (sub) => sub.daysUntilRenewal != null && sub.daysUntilRenewal >= 0 && sub.daysUntilRenewal <= 7;

export const FILTERS = {
  all: { label: 'All', test: () => true },
  active: { label: 'Paid', test: (s) => s.status !== 'trial' },
  week: { label: 'This week', test: isThisWeek },
  trial: { label: 'Free trials', test: (s) => s.status === 'trial' },
  attention: { label: 'Needs attention', test: (s) => s.status === 'failed' },
};

export const SORTS = {
  renewal: { label: 'Next renewal', compare: (a, b) => (a.nextRenewal ?? '9999').localeCompare(b.nextRenewal ?? '9999') },
  cost: { label: 'Cost per month', compare: (a, b) => (b.monthly ?? -1) - (a.monthly ?? -1) },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
};
