import { Outlet } from 'react-router-dom';
import StartupSplash from '@/components/StartupSplash';

export default function PublicLayout() {
  return (
    <div className="min-h-svh bg-background">
      <Outlet />
      <StartupSplash />
    </div>
  );
}
