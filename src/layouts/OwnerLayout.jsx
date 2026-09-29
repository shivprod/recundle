import { Outlet, useNavigate } from 'react-router-dom';
import StartupSplash from '@/components/StartupSplash';
import SiteHeader from '@/components/SiteHeader';
import ApperIcon from '@/components/ApperIcon';
import { useGmail } from '@/gmail';
import { LOCAL_ACCOUNT } from '@/gmail/useGmail';
import { clearPreferredName } from '@/personalization';

export default function OwnerLayout() {
  const navigate = useNavigate();
  const { isConnected, account, disconnect } = useGmail();

  const signOut = async () => {
    await disconnect();
    clearPreferredName(LOCAL_ACCOUNT);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader
        actions={
          isConnected && (
            <>
              <span className="hidden max-w-[16rem] truncate text-sm text-muted-foreground lg:inline">{account?.email}</span>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[15px] font-medium text-primary transition-colors hover:bg-accent"
              >
                <ApperIcon name="LogOut" size={16} />
                Sign out
              </button>
            </>
          )
        }
      />
      <Outlet />
      <StartupSplash />
    </div>
  );
}
