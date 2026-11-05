import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { animate, AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/cn';

export function Icon({ name, size = 18, className, ...props }) {
  const C = Icons[name] ?? Icons.Circle;
  return <C size={size} className={className} aria-hidden="true" {...props} />;
}

const BUTTON = {
  primary: 'bg-primary text-primary-ink hover:opacity-90',
  brand: 'bg-brand text-brand-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:border-ink/30',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
  danger: 'bg-bad text-white hover:brightness-110',
  'danger-ghost': 'text-bad hover:bg-bad-soft',
};

export function Button({ variant = 'primary', size = 'md', icon, iconRight, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-12 px-6 text-[16px]' : 'h-10 px-4 text-[14px]',
        BUTTON[variant],
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
    </button>
  );
}

export function Card({ className, children, as, ...props }) {
  const reduce = useReducedMotion();
  const Tag = as ? motion.create(as) : motion.section;
  return (
    <Tag
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn('card min-w-0 p-4 sm:p-6', className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHead({ title, subtitle, action, icon }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[17px] font-medium">
          {icon && <Icon name={icon} size={18} className="text-brand" />}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
  muted: 'bg-surface-2 text-ink-2',
  brand: 'bg-brand-soft text-brand',
};

export function Badge({ tone = 'muted', icon, children, className }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-tight tracking-[0.04em]', TONES[tone], className)}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/** Counts a formatted figure ("₹1,24,838", "+₹4,562", "17%", "12") up from zero when it scrolls into view. */
export function CountUp({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const m = typeof value === 'string' || typeof value === 'number' ? String(value).match(/^([^\d]*?)([\d,]+(?:\.\d+)?)(.*)$/) : null;
  const target = m ? Number(m[2].replace(/,/g, '')) : null;
  const [shown, setShown] = useState(reduce || target == null ? value : `${m[1]}0${m[3]}`);
  useEffect(() => {
    if (!m || reduce) {
      setShown(value);
      return undefined;
    }
    if (!inView) return undefined;
    const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0;
    const fmt = (n) => (m[2].includes(',') ? n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals));
    const controls = animate(0, target, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (n) => setShown(`${m[1]}${fmt(n)}${m[3]}`) });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView]);
  return <span ref={ref}>{shown}</span>;
}

/** A headline number. `onClick` makes the whole tile a button that drills into the detail. */
export function Tile({ label, value, sub, icon, tone, onClick, emphasis, className, spark }) {
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'card group relative flex min-w-0 flex-col p-4 text-left transition-[transform,box-shadow,border-color] duration-200 sm:p-5',
        onClick && 'cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-ink hover:shadow-[4px_4px_0_0_var(--ink)]',
        emphasis && 'border-brand/60',
        className,
      )}
    >
      {emphasis && <span className="absolute inset-x-0 top-0 h-[3px] bg-brand" aria-hidden="true" />}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</span>
        {icon && (
          <span className={cn('flex size-7 items-center justify-center rounded border', tone ? cn(TONES[tone], 'border-transparent') : 'border-line text-ink-2')}>
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      <div className="tnum mt-2 truncate font-display text-[24px] font-medium leading-tight tracking-tight sm:text-[28px]">
        <CountUp value={value} />
      </div>
      {sub && <div className="mt-1 flex min-w-0 items-center gap-1 truncate text-[12.5px] text-ink-3">{sub}</div>}
      {spark && <div className="-mx-1 mt-2">{spark}</div>}
      {onClick && <Icon name="ArrowUpRight" size={14} className="absolute bottom-4 right-4 text-ink-3 opacity-0 transition group-hover:opacity-100" />}
    </Tag>
  );
}

/** Template-style tabs: plain labels on a hairline, with a sliding underline under the active one. */
export function Segmented({ options, value, onChange, label, size = 'md', className, id }) {
  const lid = useId();
  return (
    <div role="group" aria-label={label} className={cn('scrollbar-none flex max-w-full gap-5 overflow-x-auto border-b border-line', size === 'sm' && 'gap-4', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn('relative shrink-0 pb-2.5 pt-1 font-medium transition-colors', size === 'sm' ? 'text-[13px]' : 'text-[14px]', active ? 'text-ink' : 'text-ink-3 hover:text-ink')}
          >
            <span className="inline-flex items-center gap-1.5">
              {o.icon && <Icon name={o.icon} size={14} />}
              {o.label}
              {o.count != null && <span className={cn('tnum rounded-sm px-1 text-[11px]', active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-3')}>{o.count}</span>}
            </span>
            {active && <motion.span layoutId={id ?? lid} className="absolute inset-x-0 -bottom-px h-[2px] bg-brand" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

const control = 'h-10 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none';

export const Input = ({ className, ...props }) => <input className={cn(control, className)} {...props} />;
export const Textarea = ({ className, ...props }) => <textarea className={cn(control, 'h-auto min-h-20 py-2', className)} {...props} />;
export function Select({ className, children, ...props }) {
  return (
    <div className="relative min-w-0">
      <select className={cn(control, 'appearance-none pr-8', className)} {...props}>
        {children}
      </select>
      <Icon name="ChevronDown" size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className, label }) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Icon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder} className={cn(control, 'pl-9')} />
    </div>
  );
}

function useLockScroll(open) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

/** Side panel on desktop, bottom sheet on phones. */
export function Sheet({ open, onClose, title, subtitle, children, footer, wide }) {
  useLockScroll(open);
  useEscape(open, onClose);
  const ref = useRef(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#18102b]/45 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ y: 40, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.1, duration: 0.35 }}
            className={cn(
              'absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col rounded-t-lg border-t border-line bg-surface outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:rounded-none sm:border-l sm:border-t-0',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <div className="text-[18px] font-semibold tracking-tight">{title}</div>
                {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
              </div>
              <button type="button" onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-ink-2 hover:bg-surface-2" aria-label="Close">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Dialog({ open, onClose, title, children, footer }) {
  useLockScroll(open);
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#18102b]/45 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.97, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 12, opacity: 0 }}
            className="relative w-full max-w-md rounded-t-lg border border-ink bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[6px_6px_0_0_var(--ink)] sm:rounded-md"
          >
            <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
            <div className="mt-3 text-[14px] text-ink-2">{children}</div>
            {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Empty({ icon = 'Inbox', title, children, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <span className="flex size-11 items-center justify-center rounded-md border border-ink/40 text-ink">
        <Icon name={icon} size={20} />
      </span>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13.5px] text-ink-3">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Where a figure comes from. Estimates are never shown as official. */
export const PROVENANCE = {
  verified: { label: 'From lender email', tone: 'good', icon: 'BadgeCheck' },
  stated: { label: 'From receipt', tone: 'good', icon: 'BadgeCheck' },
  user: { label: 'Entered by you', tone: 'info', icon: 'UserPen' },
  estimated: { label: 'Estimated', tone: 'warn', icon: 'Calculator' },
  inferred: { label: 'Estimated', tone: 'warn', icon: 'Calculator' },
  missing: { label: 'Not available', tone: 'muted', icon: 'CircleDashed' },
  ai: { label: 'Read by AI', tone: 'info', icon: 'Sparkles' },
};

export function Provenance({ source, title }) {
  const p = PROVENANCE[source] ?? PROVENANCE.missing;
  return (
    <Badge tone={p.tone} icon={p.icon} className="font-medium">
      <span title={title}>{p.label}</span>
    </Badge>
  );
}

export function Spinner({ size = 18, className }) {
  return <Icon name="LoaderCircle" size={size} className={cn('animate-spin', className)} />;
}

export function GmailLink({ messageId, email, children = 'Open email', className }) {
  if (!messageId) return null;
  const href = `https://mail.google.com/mail/${email ? `?authuser=${encodeURIComponent(email)}` : 'u/0/'}#all/${messageId}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn('inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline', className)}>
      <Icon name="Mail" size={14} />
      {children}
      <Icon name="ArrowUpRight" size={13} />
    </a>
  );
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[32px] font-medium leading-[1.05] sm:text-[44px]">{title}</motion.h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-2">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Progress({ value, className, tone = 'primary' }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={Math.round((value ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn('h-full rounded-full', tone === 'primary' ? 'bg-brand' : tone === 'good' ? 'bg-good' : 'bg-warn')} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, value ?? 0)) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}
