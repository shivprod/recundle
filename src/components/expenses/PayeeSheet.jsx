import { useMemo } from 'react';
import { Badge, Sheet } from '@/components/ui';
import { inr, shortDate } from '@/core/format';
import { useApp } from '@/data/AppData';
import { categoryMap, GroupedList } from './common';

/** Everything paid to (or received from) one payee, all time. */
export default function PayeeSheet({ payeeKey, onClose, onOpenTxn }) {
  const { txns, store, today } = useApp();
  const cats = useMemo(() => categoryMap(store.categories), [store.categories]);
  const list = useMemo(() => txns.filter((t) => t.entityKey === payeeKey), [txns, payeeKey]);
  const out = list.filter((t) => t.direction === 'out' && !t.excluded);
  const inn = list.filter((t) => t.direction === 'in' && !t.excluded);
  const sum = (l) => l.reduce((s, t) => s + t.amount, 0);
  const name = list[0]?.counterparty ?? '';
  return (
    <Sheet open={Boolean(payeeKey)} onClose={onClose} title={name} subtitle={list.length ? `${list.length} transactions · ${shortDate(list[list.length - 1].date, true)} – ${shortDate(list[0].date, true)}` : ''}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          ['Paid', inr(sum(out))],
          ['Received', inr(sum(inn))],
          ['Payments', out.length],
          ['Average', out.length ? inr(Math.round(sum(out) / out.length)) : '—'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <p className="text-[12px] text-ink-3">{l}</p>
            <p className="tnum text-[16px] font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {list[0]?.isPerson && <Badge tone="info" icon="User" className="mt-3">Looks like a person</Badge>}
      <div className="mt-4">
        <GroupedList txns={list} cats={cats} onOpen={onOpenTxn} today={today} />
      </div>
    </Sheet>
  );
}
