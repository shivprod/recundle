import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function RootLayout() {
  return (
    <ErrorBoundary fullPage>
      <Outlet />
    </ErrorBoundary>
  );
}
