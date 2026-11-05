import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppDataProvider, useApp } from '@/data/AppData';
import AppShell from '@/components/layout/AppShell';
import Landing from '@/pages/Landing';
import { Spinner } from '@/components/ui';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Subscriptions = lazy(() => import('@/pages/Subscriptions'));
const Loans = lazy(() => import('@/pages/Loans'));
const Todos = lazy(() => import('@/pages/Todos'));
const Settings = lazy(() => import('@/pages/Settings'));

function Loading() {
  return (
    <div className="flex min-h-[50svh] items-center justify-center text-ink-3">
      <Spinner size={26} />
    </div>
  );
}

function RequireUser({ children }) {
  const { session } = useApp();
  if (session.status === 'loading') return <Loading />;
  if (!session.user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            element={
              <RequireUser>
                <AppShell />
              </RequireUser>
            }
          >
            {[
              ['/dashboard', Dashboard],
              ['/expenses', Expenses],
              ['/subscriptions', Subscriptions],
              ['/loans', Loans],
              ['/todos', Todos],
              ['/settings', Settings],
            ].map(([path, Page]) => (
              <Route
                key={path}
                path={path}
                element={
                  <Suspense fallback={<Loading />}>
                    <Page />
                  </Suspense>
                }
              />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </AppDataProvider>
  );
}
