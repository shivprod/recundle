import { Outlet, useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import StartupSplash from '@/components/StartupSplash';
import { RecundleLogo } from '@/components/RecundleLogo';
import { useGmail } from '@/gmail';
import { LOCAL_ACCOUNT } from '@/gmail/useGmail';
import { clearPreferredName } from '@/personalization';

export default function OwnerLayout() {
  const navigate = useNavigate();
  const { isConnected, disconnect } = useGmail();

  const signOut = async () => {
    await disconnect();
    clearPreferredName(LOCAL_ACCOUNT);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-background/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-4">
          <RecundleLogo size="sm" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isConnected && (
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg px-2 py-1.5 text-[15px] font-medium text-primary hover:bg-accent"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <StartupSplash />
    </div>
  );
}
