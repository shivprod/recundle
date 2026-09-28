import {
  siAudible,
  siClaude,
  siDuolingo,
  siGoogleplay,
  siNetflix,
  siNotion,
  siPerplexity,
  siSpotify,
  siSwiggy,
  siYoutube,
} from 'simple-icons';
import { cn } from '@/lib/utils';
import { RecundleMark } from '@/components/RecundleLogo';
import './SyncShowcase.css';

// Positions are offsets from the centre in container-width units (cqw), so
// the constellation scales with the stage. `d` staggers each tile's float.
const APPS = [
  { icon: siNetflix, x: -34, y: -30, r: -8, d: 0 },
  { label: 'prime video', hex: '00A8E1', title: 'Prime Video', x: 2, y: -40, r: 4, d: 1.2 },
  { icon: siClaude, x: 36, y: -28, r: 8, d: 0.6 },
  { icon: siYoutube, x: -42, y: 2, r: 6, d: 1.8 },
  { icon: siSpotify, x: 42, y: 4, r: -6, d: 0.3 },
  { icon: siNotion, x: -34, y: 32, r: -4, d: 1.5 },
  { icon: siSwiggy, x: 0, y: 40, r: 6, d: 0.9 },
  { icon: siPerplexity, x: 34, y: 32, r: -8, d: 2.1 },
  { icon: siAudible, x: -16, y: -18, r: 10, d: 2.4, small: true },
  { icon: siDuolingo, x: 18, y: 20, r: -10, d: 2.7, small: true },
  { icon: siGoogleplay, x: -18, y: 20, r: 6, d: 3.0, small: true },
];

function Tile({ app, index }) {
  const hex = app.icon?.hex ?? app.hex;
  const title = app.icon?.title ?? app.title;
  const dark = /^(000000|191919|414141)$/i.test(hex);
  return (
    <div
      className={cn('sync-tile', app.small && 'sync-tile--small', dark && 'sync-tile--dark')}
      style={{
        '--x': `${app.x}cqw`,
        '--y': `${app.y}cqw`,
        '--r': `${app.r}deg`,
        '--delay': `${app.d}s`,
        '--gather-delay': `${(index % 6) * 0.22}s`,
        '--tile-bg': `#${hex}`,
      }}
      title={title}
    >
      {app.icon ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={app.icon.path} />
        </svg>
      ) : (
        <span className="sync-tile__text">{app.label}</span>
      )}
    </div>
  );
}

/**
 * Floating logos of popular subscription services around the Recundle mark.
 * While `syncing`, the tiles are drawn into the mark, like receipts being
 * bundled.
 */
export default function SyncShowcase({ syncing = false, className }) {
  return (
    <div
      className={cn('sync-stage', syncing && 'is-syncing', className)}
      role="img"
      aria-label="Netflix, Prime Video, Claude, YouTube, Spotify and other subscription services around the Recundle logo"
    >
      {APPS.map((app, i) => (
        <Tile key={app.icon?.slug ?? app.label} app={app} index={i} />
      ))}
      <div className="sync-core">
        <RecundleMark size={52} />
      </div>
    </div>
  );
}
