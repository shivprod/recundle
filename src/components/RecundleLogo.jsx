import { useId } from 'react';
import { APP_CONFIG } from '@/config/app.config';
import { cn } from '@/lib/utils';

/**
 * The Recundle symbol, traced from the brand guidelines.
 * `variant="color"` uses the brand teals, switching to the monochrome-reversed
 * (white) mark in dark mode per the guidelines (--logo-* tokens in theme.css);
 * `variant="mono"` draws the symbol in `currentColor`.
 */
export function RecundleMark({ size = 32, variant = 'color', className, title }) {
  const clipId = useId();
  const mono = variant === 'mono';
  const top = mono ? 'currentColor' : 'var(--logo-top)';
  const body = mono ? 'currentColor' : 'var(--logo-body)';
  const pillar = mono ? 'currentColor' : 'var(--logo-pillar)';

  return (
    <svg
      viewBox="60 36 440 512"
      width={size * (440 / 512)}
      height={size}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="245" y="0" width="300" height="600" />
        </clipPath>
      </defs>
      <path
        d="M68 202 Q68 138 138 138 Q208 138 208 202 L208 500 Q208 518 190 512 L128 490 Q68 468 68 418 Z"
        style={{ fill: pillar }}
      />
      <path d="M126 116 L234 50 Q246 43 258 48 L461 134 A56 56 0 0 1 419 238 Z" style={{ fill: top }} />
      <g clipPath={`url(#${clipId})`} style={{ stroke: body }} fill="none" strokeWidth="45" strokeLinecap="round">
        <path d="M225 227 L386 292" />
        <path d="M225 309 L386 374" />
      </g>
      <g style={{ stroke: body }} strokeWidth="15" strokeLinecap="round">
        <path d="M392 295 L440 300" />
        <path d="M392 377 L440 385" />
      </g>
      <circle cx="440" cy="300" r="26" style={{ fill: body }} />
      <circle cx="440" cy="385" r="26" style={{ fill: body }} />
      <path
        d="M245 371.7 L446.9 453.3 A45 45 0 0 1 413.1 536.7 L292 488 Q245 469 245 428 Z"
        style={{ fill: body }}
      />
    </svg>
  );
}

const LOCKUP_SIZES = {
  sm: { mark: 28, name: 'text-lg', tagline: 'text-[10px]' },
  md: { mark: 44, name: 'text-3xl', tagline: 'text-xs' },
  lg: { mark: 64, name: 'text-5xl', tagline: 'text-sm' },
};

/** Horizontal lockup: symbol + "Recundle" wordmark, optionally with the tagline. */
export function RecundleLogo({ size = 'md', showTagline = false, variant = 'color', className }) {
  const s = LOCKUP_SIZES[size] ?? LOCKUP_SIZES.md;
  return (
    <div className={cn('flex items-center gap-3', className)} aria-label={APP_CONFIG.name} role="img">
      <RecundleMark size={s.mark} variant={variant} />
      <div className="flex flex-col">
        <span className={cn('font-heading font-bold tracking-tight leading-none', s.name)}>
          {APP_CONFIG.name}
        </span>
        {showTagline && (
          <span className={cn('mt-1.5 tracking-[0.14em] text-muted-foreground', s.tagline)}>
            {APP_CONFIG.tagline}
          </span>
        )}
      </div>
    </div>
  );
}
