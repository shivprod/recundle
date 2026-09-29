import {
  siAirtel,
  siApplemusic,
  siAudible,
  siClaude,
  siCursor,
  siDuolingo,
  siGoogleplay,
  siNetflix,
  siNotion,
  siPerplexity,
  siSpotify,
  siSwiggy,
  siUber,
  siYoutube,
  siYoutubemusic,
  siZomato,
} from 'simple-icons';
import { cn } from '@/lib/utils';

// Merchant-name patterns → brand mark (Simple Icons, CC0). Order matters:
// more specific names first. Prime Video isn't in Simple Icons, so it's a
// text tile in Prime's blue rather than Amazon's logo.
const BRANDS = [
  [/youtube music/i, siYoutubemusic],
  [/youtube/i, siYoutube],
  [/netflix/i, siNetflix],
  [/spotify/i, siSpotify],
  [/claude|anthropic/i, siClaude],
  [/notion/i, siNotion],
  [/duolingo/i, siDuolingo],
  [/audible/i, siAudible],
  [/perplexity/i, siPerplexity],
  [/cursor/i, siCursor],
  [/swiggy/i, siSwiggy],
  [/zomato/i, siZomato],
  [/apple music/i, siApplemusic],
  [/airtel/i, siAirtel],
  [/uber/i, siUber],
  [/google play/i, siGoogleplay],
  [/prime|amazon/i, { label: 'prime', hex: '00A8E1' }],
];

const DARK_MARKS = /^(000000|191919|414141)$/i;

export function findBrand(name) {
  return BRANDS.find(([pattern]) => pattern.test(name ?? ''))?.[1] ?? null;
}

/** App-icon style tile for a subscription: brand mark if known, else its initial. */
export default function ServiceIcon({ name, className }) {
  const brand = findBrand(name);
  const base = '@container flex size-10 shrink-0 items-center justify-center rounded-[11px] text-white';

  if (!brand) {
    return (
      <div className={cn(base, 'bg-secondary text-base font-semibold text-secondary-foreground', className)} aria-hidden="true">
        {String(name ?? '?').charAt(0).toUpperCase()}
      </div>
    );
  }

  const dark = DARK_MARKS.test(brand.hex);
  return (
    <div
      className={cn(base, dark && 'ring-1 ring-inset ring-white/15', className)}
      style={{ background: dark ? '#1b1b1b' : `#${brand.hex}` }}
      aria-hidden="true"
    >
      {brand.path ? (
        <svg viewBox="0 0 24 24" className="size-[52%] fill-current">
          <path d={brand.path} />
        </svg>
      ) : (
        <span className="text-[24cqw] font-bold leading-none">{brand.label}</span>
      )}
    </div>
  );
}
