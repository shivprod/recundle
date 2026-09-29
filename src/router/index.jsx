import { createBrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import RootLayout from '@/layouts/RootLayout';
import OwnerLayout from '@/layouts/OwnerLayout';
import PublicLayout from '@/layouts/PublicLayout';
import { Loader2 } from 'lucide-react';

const PageLoader = () => (
  <div className="h-screen flex items-center justify-center bg-background">
    <Loader2 className="size-8 animate-spin text-muted-foreground" />
  </div>
);

const wrap = (Component) => (
  <Suspense fallback={<PageLoader />}><Component /></Suspense>
);

// Auto-discover: eager modules for route metadata + lazy loaders for code-splitting
const pageMods = import.meta.glob('/src/pages/**/*.jsx', { eager: true });
const pageLoaders = import.meta.glob('/src/pages/**/*.jsx');
const NotFoundPage = lazy(() => import('@/pages/NotFound'));

const discoveredRoutes = Object.entries(pageMods)
  .filter(([, mod]) => mod.route)
  .map(([filePath, mod]) => ({
    ...mod.route,
    _component: lazy(pageLoaders[filePath]),
  }));

function buildDiscoveredRoute(r) {
  const isIndex = r.path === '/';
  const config = {
    element: wrap(r._component),
  };
  if (isIndex) config.index = true;
  else config.path = r.path.replace(/^\//, '');
  return config;
}

const ownerRoutes = discoveredRoutes.filter((r) => r.layout === 'owner').map(buildDiscoveredRoute);
const publicRoutes = discoveredRoutes.filter((r) => r.layout === 'public').map(buildDiscoveredRoute);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        element: <OwnerLayout />,
        children: [...ownerRoutes],
      },
      {
        element: <PublicLayout />,
        children: [...publicRoutes],
      },
      { path: '*', element: wrap(NotFoundPage) },
    ],
  },
]);
