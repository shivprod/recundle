import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/ui';
import { RecundleMark } from '@/components/layout/Logo';
import { cn } from '@/lib/cn';

/** Line-drawn window, as in the template's isometric art. */
function Window({ children, className, ghost }) {
  return (
    <div className={cn('rounded-md border bg-surface', ghost ? 'border-line' : 'border-ink/70 shadow-[6px_6px_0_0_var(--ink)]', className)}>
      <div className={cn('flex gap-1.5 border-b px-3 py-2', ghost ? 'border-line' : 'border-ink/60')}>
        {[0, 1, 2].map((i) => <span key={i} className={cn('size-2 rounded-full border', ghost ? 'border-line' : 'border-ink/60')} />)}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

const Line = ({ w = '100%', className }) => <span className={cn('block h-1.5 rounded-full bg-ink/15', className)} style={{ width: w }} />;

export function ModuleMini({ id }) {
  if (id === 'expenses')
    return (
      <div className="flex h-36 flex-col gap-2">
        <div className="flex gap-2">
          {['+₹85K', '−₹40K', '+₹45K'].map((v) => (
            <div key={v} className="flex-1 rounded border border-ink/30 px-2 py-1.5">
              <Line w="60%" />
              <p className="mt-1 font-display text-[12px] font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-1 items-end gap-1.5 border-b border-ink/30 px-1">
          {[40, 62, 48, 70, 55, 78, 45, 66].map((h, i) => (
            <motion.span key={i} className={cn('flex-1 rounded-t-sm', i % 2 ? 'bg-[var(--viz-out)]/80' : 'bg-[var(--viz-in)]/80')} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: i * 0.05, duration: 0.6 }} />
          ))}
        </div>
      </div>
    );
  if (id === 'subscriptions')
    return (
      <div className="flex h-36 flex-col gap-1.5">
        {[['Netflix', 'Renews 2 Dec'], ['Spotify', 'Payment failed'], ['Google One', 'Renews 14 Dec'], ['Claude', 'Renews 20 Dec']].map(([n, s], i) => (
          <motion.div key={n} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="flex items-center gap-2 rounded border border-ink/25 px-2 py-1.5">
            <span className="flex size-5 items-center justify-center rounded-sm border border-ink/40 text-[9px] font-bold">{n[0]}</span>
            <span className="flex-1 text-[11px] font-medium">{n}</span>
            <span className={cn('text-[10px]', s.includes('failed') ? 'text-bad' : 'text-ink-3')}>{s}</span>
          </motion.div>
        ))}
      </div>
    );
  if (id === 'loans')
    return (
      <div className="flex h-36 flex-col gap-2">
        {[['Home loan', 0.42], ['Personal loan', 0.78], ['Two-wheeler', 0.93]].map(([n, p], i) => (
          <div key={n} className="rounded border border-ink/25 px-2 py-1.5">
            <div className="flex justify-between text-[11px] font-medium">
              <span>{n}</span>
              <span className="text-ink-3">{Math.round(p * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-ink/10">
              <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${p * 100}%` }} transition={{ delay: 0.1 + i * 0.1, duration: 0.7 }} />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[10.5px] text-good"><Icon name="FileCheck2" size={12} /> NOC found · review to close</div>
      </div>
    );
  return (
    <div className="grid h-36 grid-cols-2 gap-2">
      {['Renew passport', 'Child check-up', 'Insurance papers', 'Tax documents'].map((t, i) => (
        <motion.div key={t} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: i * 0.08, duration: 0.4 }} className={cn('flex flex-col justify-between rounded border border-ink/25 p-2', i === 1 && 'bg-ink text-primary-ink')}>
          <span className="text-[11px] font-medium leading-tight">{t}</span>
          <span className="text-[9.5px] opacity-70">{i === 1 ? 'Done' : 'Pending'}</span>
        </motion.div>
      ))}
    </div>
  );
}

/** A stack of windows in isometric projection; the front one shows the chosen module. */
export function IsoStack({ active }) {
  return (
    <div className="relative mx-auto h-[360px] w-full max-w-[460px]" style={{ perspective: 1600 }} aria-hidden="true">
      <div className="iso absolute left-1/2 top-1/2 w-[300px] -translate-x-1/2 -translate-y-1/2">
        {[3, 2, 1].map((z) => (
          <div key={z} className="absolute inset-0" style={{ transform: `translate3d(${z * 26}px, ${-z * 26}px, ${-z * 2}px)` }}>
            <Window ghost>
              <div className="h-36" />
            </Window>
          </div>
        ))}
        <div className="relative">
          <Window>
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <ModuleMini id={active} />
              </motion.div>
            </AnimatePresence>
          </Window>
        </div>
      </div>
    </div>
  );
}

/** Hero art: the dashboard as a line-drawn isometric slab over the pixel field. */
export function HeroSlab() {
  return (
    <div className="pointer-events-none relative mx-auto -mt-44 h-[340px] w-full max-w-[760px] sm:-mt-60 sm:h-[420px]" style={{ perspective: 1800 }} aria-hidden="true">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0">
      <div className="iso absolute left-1/2 top-[46%] w-[520px] -translate-x-1/2 -translate-y-1/2 scale-[0.62] sm:scale-100">
        <div className="rounded-lg border border-ink/70 bg-surface p-4 shadow-[10px_10px_0_0_var(--ink)]">
          <div className="flex items-center gap-2 border-b border-ink/20 pb-3">
            <RecundleMark className="size-6" />
            <span className="font-display text-[14px] font-semibold">Recundle</span>
            <span className="ml-auto flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full border border-ink/50" />)}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[['Money in', '₹85,000'], ['Money out', '₹40,438'], ['Net', '+₹44,562'], ['Owed', '₹1,00,000']].map(([l, v]) => (
              <div key={l} className="rounded border border-ink/30 p-2">
                <p className="text-[9px] text-ink-3">{l}</p>
                <p className="font-display text-[13px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-2">
            <div className="flex h-24 items-end gap-1.5 rounded border border-ink/30 p-2">
              {[30, 52, 41, 66, 48, 72, 58, 80].map((h, i) => <span key={i} className={cn('flex-1 rounded-t-sm', i % 2 ? 'bg-[var(--viz-out)]/80' : 'bg-[var(--viz-in)]/80')} style={{ height: `${h}%` }} />)}
            </div>
            <div className="flex flex-col gap-1.5 rounded border border-ink/30 p-2">
              {['Netflix · 2 Dec', 'EMI · 5 Dec', 'Rent · 1 Jan'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[9.5px]"><span className="size-1.5 rounded-full bg-ink" />{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      </motion.div>
    </div>
  );
}

/** "Connects to what you already use": sources wired to the Recundle mark. */
export function SourcesDiagram() {
  const sources = [
    ['Mail', 'Gmail alerts & receipts'],
    ['HardDrive', 'Google Drive (your data)'],
    ['FileSpreadsheet', 'Bank statements (CSV)'],
    ['Smartphone', 'UPI apps via email'],
    ['CreditCard', 'Card alerts'],
    ['Landmark', 'Lender emails & NOCs'],
  ];
  return (
    <div className="relative mx-auto grid max-w-3xl grid-cols-2 items-center gap-y-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-x-10">
      <ul className="flex flex-col gap-3">
        {sources.slice(0, 3).map(([icon, label], i) => <Source key={label} icon={icon} label={label} i={i} />)}
      </ul>
      <div className="order-first col-span-2 flex justify-center sm:order-none sm:col-span-1">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} className="flex size-28 items-center justify-center rounded-xl border border-ink/70 bg-surface shadow-[6px_6px_0_0_var(--ink)]">
          <RecundleMark className="size-14" />
        </motion.div>
      </div>
      <ul className="flex flex-col gap-3">
        {sources.slice(3).map(([icon, label], i) => <Source key={label} icon={icon} label={label} i={i + 3} />)}
      </ul>
    </div>
  );
}

function Source({ icon, label, i }) {
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded border border-ink/40"><Icon name={icon} size={16} /></span>
      <span className="text-[13.5px] font-medium">{label}</span>
    </motion.li>
  );
}

/** The closing section's geometric line shapes. */
export function Shapes() {
  return (
    <svg viewBox="0 0 340 340" className="h-auto w-full max-w-[340px] text-ink/25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M170 10 A160 160 0 0 0 10 170 L170 170 Z" />
      <path d="M170 10 L250 90 L170 90" />
      <path d="M250 90 L330 170 L170 170 L170 90 Z" />
      <circle cx="90" cy="250" r="80" />
      <path d="M170 170 A80 80 0 0 1 170 330 Z" />
      <path d="M250 170 A80 80 0 0 0 250 330 L330 330 L330 170 Z" />
    </svg>
  );
}
