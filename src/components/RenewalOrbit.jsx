import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ServiceIcon from '@/components/ServiceIcon';
import { RecundleMark } from '@/components/RecundleLogo';
import { cn } from '@/lib/utils';
import './RenewalOrbit.css';

// Illustrative month: each subscription sits on the dial at its renewal day.
const RENEWALS = [
  { name: 'Netflix', day: 3, amount: 649 },
  { name: 'Duolingo', day: 6, amount: 125 },
  { name: 'Spotify', day: 9, amount: 139 },
  { name: 'YouTube Premium', day: 13, amount: 149 },
  { name: 'Claude', day: 17, amount: 450 },
  { name: 'Prime Video', day: 21, amount: 299 },
  { name: 'Notion', day: 25, amount: 100 },
  { name: 'Swiggy One', day: 28, amount: 99 },
];
const DAYS = 31;
const MONTH_TOTAL = RENEWALS.reduce((n, r) => n + r.amount, 0);
const angleOf = (day) => ((day - 1) / DAYS) * 360;
const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;
const ordinal = (d) => `${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}`;

/**
 * Hero motion: a month dial. A hand sweeps from the 1st to the 31st; as it
 * passes each subscription's renewal day the icon pulses, the centre shows
 * that renewal and the month's total counts up. While `syncing`, the hand
 * speeds up, like receipts being read.
 */
export default function RenewalOrbit({ syncing = false, className }) {
  const reduce = useReducedMotion();
  const handRef = useRef(null);
  const [hit, setHit] = useState({ index: -1, lap: 0 });
  const period = syncing ? 3200 : 13000;
  const periodRef = useRef(period);
  periodRef.current = period;

  useEffect(() => {
    if (reduce) return undefined;
    let angle = 0;
    let last = performance.now();
    let current = -1;
    let lap = 0;
    let frame;
    const tick = (now) => {
      angle += ((now - last) / periodRef.current) * 360;
      last = now;
      if (angle >= 360) {
        angle -= 360;
        lap += 1;
        current = -1;
        setHit({ index: -1, lap });
      }
      if (handRef.current) handRef.current.style.transform = `rotate(${angle}deg)`;
      let idx = -1;
      RENEWALS.forEach((r, i) => { if (angleOf(r.day) <= angle) idx = i; });
      if (idx !== current) {
        current = idx;
        setHit({ index: idx, lap });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce]);

  const index = reduce ? RENEWALS.length - 1 : hit.index;
  const total = RENEWALS.slice(0, index + 1).reduce((n, r) => n + r.amount, 0);
  const active = index >= 0 ? RENEWALS[index] : null;

  return (
    <div
      className={cn('orbit', syncing && 'is-syncing', className)}
      role="img"
      aria-label={`A month of renewals: ${RENEWALS.map((r) => `${r.name} on the ${ordinal(r.day)}`).join(', ')}. ${rupees(MONTH_TOTAL)} a month in total.`}
    >
      <div className="orbit__glow" aria-hidden="true" />
      <div className="orbit__ring" aria-hidden="true">
        {Array.from({ length: DAYS }, (_, i) => (
          <span
            key={i}
            className={cn('orbit__tick', (i + 1) % 7 === 1 && 'orbit__tick--major')}
            style={{ '--a': `${angleOf(i + 1)}deg` }}
          />
        ))}
        {[1, 8, 15, 22].map((d) => (
          <span key={d} className="orbit__day" style={{ '--a': `${angleOf(d)}deg` }}>
            <span style={{ '--a': `${-angleOf(d)}deg` }}>{d}</span>
          </span>
        ))}
      </div>
      <div className="orbit__inner" aria-hidden="true" />

      {!reduce && (
        <div ref={handRef} className="orbit__hand" aria-hidden="true">
          <span className="orbit__sweep" />
          <span className="orbit__needle" />
        </div>
      )}

      {RENEWALS.map((r, i) => {
        const a = (angleOf(r.day) * Math.PI) / 180;
        const passed = i <= index;
        return (
          <div
            key={r.name}
            className={cn('orbit__sat', passed && 'is-passed')}
            style={{ '--x': `${Math.sin(a) * 42}cqw`, '--y': `${-Math.cos(a) * 42}cqw` }}
          >
            <motion.div
              key={i === index ? `hit-${hit.lap}` : 'rest'}
              initial={false}
              animate={i === index && !reduce ? { scale: [1, 1.22, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <ServiceIcon name={r.name} className="orbit__icon" />
            </motion.div>
            {i === index && !reduce && <span key={`ripple-${hit.lap}`} className="orbit__ripple" />}
          </div>
        );
      })}

      <div className="orbit__core">
        <RecundleMark size={30} />
        <p className="orbit__total">
          <motion.span key={total} initial={{ y: 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
            {rupees(total)}
          </motion.span>
        </p>
        <p className="orbit__label">{syncing ? 'reading receipts…' : 'this month'}</p>
        <div className="orbit__now">
          <AnimatePresence mode="wait" initial={false}>
            {active && (
              <motion.span
                key={`${active.name}-${hit.lap}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                {active.name} · {rupees(active.amount)} on the {ordinal(active.day)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
