import { Outlet } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import StartupSplash from '@/components/StartupSplash';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/layouts/RootLayout';
import { RecundleLogo } from '@/components/RecundleLogo';

export default function PublicLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-svh bg-background relative">
      <div className="absolute top-4 left-4">
        <RecundleLogo size="sm" />
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={logout}>
          <ApperIcon name="LogOut" size={16} />
          Sign out
        </Button>
        <ThemeToggle />
      </div>
      <Outlet />
      <StartupSplash />
    </div>
  );
}
