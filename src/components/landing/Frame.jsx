import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useMemo, useRef } from 'react';
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

function ScrollWord({ progress, i, n, muted, children }) {
  // Each word fills in as the heading scrolls up the screen, the template's signature effect.
  const opacity = useTransform(progress, [i / n, Math.min(1, (i + 1.5) / n)], [0.16, muted ? 0.5 : 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block text-ink">
      {children}
    </motion.span>
  );
}

/**
 * Two-tone heading: the first part in ink, the rest in grey. Scroll headings fill in word by word as
 * they move up the screen; `scroll={false}` (the hero) rises in on load instead.
 */
export function Heading({ dark, muted, as: Tag = 'h2', className, center, scroll = true }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll(scroll ? { target: ref, offset: ['start 0.92', 'start 0.42'] } : {});
  const words = [...dark.split(' ').map((w) => [w, false]), ...(muted ? muted.split(' ').map((w) => [w, true]) : [])];
  const cls = cn('font-display text-[38px] font-medium leading-[1.06] tracking-[-0.035em] text-balance sm:text-[56px]', center && 'text-center', className);
  if (scroll && !reduce) {
    return (
      <Tag ref={ref} className={cls}>
        {words.map(([w, m], i) => (
          <span key={`${w}-${i}`}>
            <ScrollWord progress={scrollYProgress} i={i} n={words.length} muted={m}>
              {w}
            </ScrollWord>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </Tag>
    );
  }
  return (
    <Tag className={cls}>
      {words.map(([w, m], i) => (
        <motion.span
          key={`${w}-${i}`}
          className={cn('inline-block', m ? 'text-ink/50' : 'text-ink')}
          initial={reduce ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, delay: 0.05 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          {w}
          {i < words.length - 1 ? '\u00a0' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}

/** An endless strip of names, as in the template's "Trusted by" row. */
export function Marquee({ items }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)' }}>
      <div className="marquee flex w-max gap-10 py-1">
        {row.map((t, i) => (
          <span key={i} className="whitespace-nowrap font-display text-[19px] font-medium text-ink/45">{t}</span>
        ))}
      </div>
    </div>
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
      const pick = rand();
      return { on, shade: 0.05 + rand() * (0.08 + (row / rows) * 0.14), delay: rand() * 6, dur: 3 + rand() * 4, color: pick < 0.035 ? 'var(--brand)' : pick < 0.05 ? 'var(--accent)' : null };
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
              ? { background: c.color ?? `color-mix(in oklab, var(--ink) ${Math.round(c.shade * 100)}%, transparent)`, animation: reduce ? 'none' : `pixel ${c.dur}s ease-in-out ${c.delay}s infinite` }
              : undefined
          }
        />
      ))}
    </div>
  );
}
