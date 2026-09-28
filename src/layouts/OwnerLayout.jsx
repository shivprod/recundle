import { Outlet } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import StartupSplash from '@/components/StartupSplash';
import { useAuth } from '@/layouts/RootLayout';
import { RecundleLogo } from '@/components/RecundleLogo';

export default function PublicLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-background/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-4">
          <RecundleLogo size="sm" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-2 py-1.5 text-[15px] font-medium text-primary hover:bg-accent"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
      <StartupSplash />
    </div>
  );
}
