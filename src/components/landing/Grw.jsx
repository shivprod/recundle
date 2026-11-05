import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/cn';

/* Pieces of the grwbox template, drawn in code in Recundle's palette. */

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * The template's circuit field: rounded cells on a 90px grid, with violet and Turbo dots that travel
 * along the lines. Pure SVG; the motion uses <animateMotion>, so it costs no JavaScript per frame.
 */
export function CircuitGrid({ width = 1600, height = 900, seed = 11, dots = 26, className }) {
  const reduce = useReducedMotion();
  const { cells, still } = useMemo(() => {
    const r = rng(seed);
    const G = 90;
    const out = [];
    const cols = Math.ceil(width / G) + 1;
    const rows = Math.ceil(height / G) + 1;
    for (let k = 0; k < cols * rows * 0.42; k++) {
      const x = Math.floor(r() * cols) * G;
      const y = Math.floor(r() * rows) * G;
      const w = (1 + Math.floor(r() * 3)) * G;
      const h = (1 + Math.floor(r() * 2)) * G;
      out.push({ x, y, w, h, rx: 14 + Math.floor(r() * 3) * 6 });
    }
    const pts = Array.from({ length: 70 }, () => ({ x: Math.floor(r() * cols) * G + (r() < 0.5 ? 0 : Math.floor(r() * G)), y: Math.floor(r() * rows) * G, c: r() < 0.7 ? 'var(--brand)' : 'var(--accent)' }));
    return { cells: out, still: pts };
  }, [width, height, seed]);
  const rectPath = (c) => `M${c.x + c.rx},${c.y} H${c.x + c.w - c.rx} Q${c.x + c.w},${c.y} ${c.x + c.w},${c.y + c.rx} V${c.y + c.h - c.rx} Q${c.x + c.w},${c.y + c.h} ${c.x + c.w - c.rx},${c.y + c.h} H${c.x + c.rx} Q${c.x},${c.y + c.h} ${c.x},${c.y + c.h - c.rx} V${c.y + c.rx} Q${c.x},${c.y} ${c.x + c.rx},${c.y} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} aria-hidden="true">
      <defs>
        <radialGradient id="cg-glow">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill="none" stroke="var(--ink)" strokeOpacity="0.09" strokeWidth="1">
        {cells.map((c, i) => (
          <path key={i} d={rectPath(c)} />
        ))}
      </g>
      <g>
        {still.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={p.c} opacity={0.75} />
        ))}
      </g>
      {!reduce && (
        <g>
          {cells.slice(0, dots).map((c, i) => (
            <g key={i}>
              <circle r="9" fill="url(#cg-glow)" opacity="0.35">
                <animateMotion dur={`${9 + (i % 7) * 2.3}s`} repeatCount="indefinite" path={rectPath(c)} begin={`${-(i * 1.7) % 9}s`} />
              </circle>
              <circle r="2.6" fill={i % 4 === 0 ? 'var(--accent)' : 'var(--brand)'}>
                <animateMotion dur={`${9 + (i % 7) * 2.3}s`} repeatCount="indefinite" path={rectPath(c)} begin={`${-(i * 1.7) % 9}s`} />
              </circle>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function Digit({ value, accent }) {
  return (
    <span className="relative inline-flex h-[1.05em] overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: '-100%', opacity: 0 }} animate={{ y: '0%', opacity: 1 }} exit={{ y: '100%', opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className={cn('inline-block', accent && 'text-brand')}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Live countdown to the start of next month: when this month's numbers reset. */
export function MonthCountdown({ className, compact }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const d = new Date(now);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  let left = Math.max(0, Math.floor((end - now) / 1000));
  const parts = [
    ['Days', Math.floor(left / 86400)],
    ['Hours', Math.floor((left %= 86400) / 3600)],
    ['Minutes', Math.floor((left %= 3600) / 60)],
    ['Seconds', left % 60],
  ];
  return (
    <div className={cn('flex items-end', className)} role="timer" aria-label="Time until next month">
      {parts.map(([label, v], i) => (
        <div key={label} className={cn('flex flex-col', i > 0 && 'border-l border-ink/12 pl-5 sm:pl-7', i < 3 && 'pr-5 sm:pr-7')}>
          <span className={cn('tnum font-display font-light leading-none tracking-[-0.04em]', compact ? 'text-[34px]' : 'text-[44px] sm:text-[56px]')}>
            {String(v)
              .padStart(2, '0')
              .split('')
              .map((ch, j) => (
                <Digit key={j} value={ch} accent={i === 3} />
              ))}
          </span>
          <span className="label-mono mt-2">{label}</span>
        </div>
      ))}
    </div>
  );
}

/** "01 / VISION" */
export function Eyebrow({ n, children, className }) {
  return (
    <p className={cn('label-mono', className)}>
      {n && <span className="text-ink-2">{n} / </span>}
      {children}
    </p>
  );
}

/** Two-tone light heading: first part ink, the rest grey. Words rise in from a blur. */
export function Title({ dark, muted, tail = '', as: Tag = 'h2', className, delay = 0 }) {
  const reduce = useReducedMotion();
  const words = [...dark.split(' ').map((w) => [w, false]), ...(muted ? muted.split(' ').map((w) => [w, true]) : [])];
  return (
    <Tag className={cn('font-display font-light leading-[1.02] tracking-[-0.045em] text-balance', className)}>
      {words.map(([w, m], i) => (
        <motion.span
          key={`${w}-${i}`}
          className={cn('inline-block', m ? 'text-ink-3' : 'text-ink')}
          initial={reduce ? false : { opacity: 0, y: '0.35em', filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, delay: delay + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          {w}
          {i < words.length - 1 ? ' ' : tail}
        </motion.span>
      ))}
    </Tag>
  );
}

/**
 * Generated "render" for a card: layered ribbons with soft gradients and a perforated texture, in the
 * palette. `variant` changes the composition so each module gets its own image.
 */
export function RibbonArt({ variant = 0, className }) {
  const id = `rb${variant}`;
  const accents = [
    ['var(--brand)', '#b79bff'],
    ['#f0e100', '#fff7a1'],
    ['var(--brand)', '#f0e100'],
    ['#6a3ce0', 'var(--brand)'],
  ][variant % 4];
  const paths = [
    ['M-40 260 C 140 40, 300 420, 520 160 S 760 40, 880 120 L 880 520 L -40 520 Z', 'M-40 330 C 160 160, 340 520, 560 260 S 780 160, 880 220'],
    ['M-40 120 C 180 360, 360 -20, 560 220 S 760 440, 880 300 L 880 520 L -40 520 Z', 'M-40 200 C 200 420, 380 80, 600 300 S 780 460, 880 380'],
    ['M-40 380 C 120 120, 380 300, 480 120 S 720 300, 880 80 L 880 520 L -40 520 Z', 'M-40 430 C 160 200, 400 400, 520 220 S 760 380, 880 160'],
    ['M-40 200 C 220 60, 280 460, 520 300 S 740 60, 880 260 L 880 520 L -40 520 Z', 'M-40 280 C 240 140, 300 520, 560 380 S 760 140, 880 340'],
  ][variant % 4];
  return (
    <svg viewBox="0 0 840 472" preserveAspectRatio="xMidYMid slice" className={cn('h-full w-full', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--surface-2) 70%, white)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--ink) 22%, var(--surface-2))" />
        </linearGradient>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor={accents[1]} />
          <stop offset="55%" stopColor={accents[0]} />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--ink) 55%, transparent)" />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--ink) 32%, var(--surface-2))" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--surface) 85%, var(--ink))" />
        </linearGradient>
        <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <circle cx="4.5" cy="4.5" r="1.6" fill="color-mix(in oklab, var(--ink) 40%, transparent)" />
        </pattern>
        <filter id={`${id}-blur`}>
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <rect width="840" height="472" fill={`url(#${id}-bg)`} />
      <path d={paths[0]} fill={`url(#${id}-g)`} />
      <path d={paths[0]} fill={`url(#${id}-dots)`} opacity="0.45" />
      <path d={paths[1]} fill="none" stroke="color-mix(in oklab, var(--ink) 35%, transparent)" strokeWidth="46" filter={`url(#${id}-blur)`} opacity="0.5" transform="translate(10 26)" />
      <path d={paths[1]} fill="none" stroke={`url(#${id}-a)`} strokeWidth="44" strokeLinecap="round" />
      <path d={paths[1]} fill="none" stroke="white" strokeOpacity="0.45" strokeWidth="3" transform="translate(0 -18)" />
    </svg>
  );
}

/** Faceted gems, shaded per face, floating slowly behind the quote panel. */
function Gem({ x, y, size, color, rotate, delay }) {
  const reduce = useReducedMotion();
  const s = size;
  const faces = [
    [`0,${-s} ${s * 0.86},${-s * 0.4} 0,${-s * 0.1}`, 0.95],
    [`0,${-s} 0,${-s * 0.1} ${-s * 0.86},${-s * 0.4}`, 0.75],
    [`${-s * 0.86},${-s * 0.4} 0,${-s * 0.1} ${-s * 0.6},${s * 0.55}`, 0.55],
    [`0,${-s * 0.1} ${s * 0.86},${-s * 0.4} ${s * 0.6},${s * 0.55}`, 0.82],
    [`0,${-s * 0.1} ${s * 0.6},${s * 0.55} 0,${s} ${-s * 0.6},${s * 0.55}`, 0.62],
  ];
  return (
    <motion.g
      initial={{ x, y, rotate }}
      animate={reduce ? undefined : { y: [y, y - 16, y], rotate: [rotate, rotate + 6, rotate] }}
      transition={{ duration: 7 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {faces.map(([pts, light], i) => (
        <polygon key={i} points={pts} fill={color} style={{ filter: `brightness(${light + 0.25})` }} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      ))}
    </motion.g>
  );
}

export function GemField({ className }) {
  return (
    <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" className={cn('h-full w-full', className)} aria-hidden="true">
      <defs>
        <radialGradient id="gem-bg" cx="55%" cy="40%" r="75%">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--surface) 92%, var(--brand))" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--surface-2) 70%, var(--ink))" />
        </radialGradient>
      </defs>
      <rect width="1200" height="640" fill="url(#gem-bg)" />
      <ellipse cx="640" cy="560" rx="380" ry="34" fill="var(--ink)" opacity="0.1" />
      <Gem x={470} y={150} size={92} color="#c9c3dd" rotate={-12} delay={0} />
      <Gem x={760} y={170} size={104} color="#834DFB" rotate={18} delay={1.2} />
      <Gem x={500} y={360} size={120} color="#8f87ab" rotate={8} delay={0.6} />
      <Gem x={840} y={400} size={128} color="#a49dbb" rotate={-20} delay={1.8} />
      <Gem x={980} y={210} size={52} color="#F0E100" rotate={30} delay={2.4} />
    </svg>
  );
}

/**
 * The template's drifting cases: a tall section whose sticky row of cards slides sideways as you
 * scroll, with a progress rule underneath.
 */
export function DriftRow({ items, renderCard }) {
  const ref = useRef(null);
  const trackRef = useRef(null);
  const [distance, setDistance] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const measure = () => setDistance(Math.max(0, (trackRef.current?.scrollWidth ?? 0) - window.innerWidth + 80));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [items.length]);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const bar = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  if (reduce) {
    return <div className="grid gap-6 px-5 sm:grid-cols-2 sm:px-8">{items.map((it, i) => renderCard(it, i))}</div>;
  }
  return (
    <div ref={ref} style={{ height: `calc(100vh + ${distance}px)` }} className="relative">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <motion.div ref={trackRef} style={{ x }} className="flex w-max gap-6 pl-5 pr-10 sm:gap-8 sm:pl-[max(2rem,calc((100vw-1224px)/2+2rem))]">
          {items.map((it, i) => renderCard(it, i))}
        </motion.div>
        <div className="mx-auto mt-10 h-px w-full max-w-[1160px] bg-ink/12 px-5">
          <motion.div style={{ width: bar }} className="h-px bg-brand" />
        </div>
      </div>
    </div>
  );
}
