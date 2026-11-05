import { cn } from '@/lib/cn';

/**
 * The Recundle mark: three stacked lines being bundled together. The original vector logo was lost
 * with the old repository; replace this with the official artwork when it's available.
 */
export function RecundleMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#834DFB" />
      <g fill="none" stroke="#F5F3FF" strokeWidth="5.5" strokeLinecap="round">
        <path d="M17 21h30" />
        <path d="M17 32h20" />
        <path d="M17 43h30" />
      </g>
      <circle cx="46.5" cy="32" r="5" fill="#F0E100" />
    </svg>
  );
}

export function RecundleLogo({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <RecundleMark />
      <span className="font-display text-[20px] font-semibold tracking-[-0.03em]">Recundle</span>
    </span>
  );
}
