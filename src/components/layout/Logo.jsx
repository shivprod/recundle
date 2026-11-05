import { cn } from '@/lib/cn';

/**
 * The Recundle mark: three stacked lines being bundled together. The original vector logo was lost
 * with the old repository; replace this with the official artwork when it's available.
 */
export function RecundleMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--primary)" />
      <g fill="none" stroke="var(--primary-ink)" strokeWidth="5" strokeLinecap="round">
        <path d="M18 22h28" />
        <path d="M18 32h20" />
        <path d="M18 42h28" />
      </g>
      <circle cx="46" cy="32" r="4" fill="var(--primary-ink)" />
    </svg>
  );
}

export function RecundleLogo({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <RecundleMark />
      <span className="text-[19px] font-bold tracking-tight">Recundle</span>
    </span>
  );
}
