import { Link } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import { RecundleLogo } from '@/components/RecundleLogo';
import { cn } from '@/lib/utils';

/**
 * Sticky, frosted header shared by the landing page and the dashboard.
 * The logo always links home; `nav` and `actions` fill the middle and right.
 */
export default function SiteHeader({ nav, actions, className }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-[var(--hairline)] bg-background/75 backdrop-blur-xl backdrop-saturate-150',
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          to="/"
          aria-label="Recundle home"
          className="rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RecundleLogo size="sm" />
        </Link>
        {nav && <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">{nav}</nav>}
        <div className={cn('flex items-center gap-2', !nav && 'ml-auto', nav && 'ml-auto md:ml-0')}>
          <ThemeToggle className="hidden sm:flex" />
          {actions}
        </div>
      </div>
    </header>
  );
}
