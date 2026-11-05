import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { cn } from '@/lib/cn';

/**
 * The template's framing: a centred column with hairline rails on both sides, a hairline across the
 * page at the top of each section, and "+" marks where they cross.
 */
export function Section({ id, children, className, inner, crosses = true, bg }) {
  return (
    <section id={id} className={cn('relative hairline scroll-mt-16', bg)}>
      <div className={cn('rails relative mx-auto w-full max-w-[1224px] px-5 sm:px-8', inner)}>
        {crosses && (
          <>
            <span className="cross -left-[6px] -top-[7px] hidden sm:block" aria-hidden="true" />
            <span className="cross -right-[6px] -top-[7px] hidden sm:block" aria-hidden="true" />
          </>
        )}
        <div className={className}>{children}</div>
      </div>
    </section>
  );
}

/** Two-tone heading: the first part in ink, the rest in grey; words rise in as it scrolls into view. */
export function Heading({ dark, muted, as: Tag = 'h2', className, center }) {
  const reduce = useReducedMotion();
  const words = [...dark.split(' ').map((w) => [w, false]), ...(muted ? muted.split(' ').map((w) => [w, true]) : [])];
  return (
    <Tag className={cn('font-display text-[38px] font-medium leading-[1.06] tracking-[-0.035em] text-balance sm:text-[56px]', center && 'text-center', className)}>
      {words.map(([w, m], i) => (
        <motion.span
          key={`${w}-${i}`}
          className={cn('inline-block', m ? 'text-ink-3/80' : 'text-ink')}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: i * 0.045, ease: [0.22, 1, 0.36, 1] }}
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}

export function Eyebrow({ children, className }) {
  return <p className={cn('text-[14px] font-medium text-ink-2', className)}>{children}</p>;
}

/** The hero's pixel field: grey squares that flicker slowly, fading out towards the top. */
export function PixelMosaic({ cols = 50, rows = 14, className }) {
  const reduce = useReducedMotion();
  const cells = useMemo(() => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: cols * rows }, (_, i) => {
      const row = Math.floor(i / cols);
      const density = 0.12 + (row / rows) * 0.62;
      const on = rand() < density;
      return { on, shade: 0.05 + rand() * (0.08 + (row / rows) * 0.14), delay: rand() * 6, dur: 3 + rand() * 4 };
    });
  }, [cols, rows]);
  return (
    <div
      aria-hidden="true"
      className={cn('grid w-full', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maskImage: 'linear-gradient(to bottom, transparent 0%, black 45%, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 45%, black 80%, transparent 100%)' }}
    >
      {cells.map((c, i) => (
        <span
          key={i}
          className="aspect-square"
          style={
            c.on
              ? { background: `color-mix(in oklab, var(--ink) ${Math.round(c.shade * 100)}%, transparent)`, animation: reduce ? 'none' : `pixel ${c.dur}s ease-in-out ${c.delay}s infinite` }
              : undefined
          }
        />
      ))}
    </div>
  );
}
