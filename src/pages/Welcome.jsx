import { Link, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { APP_CONFIG, GENERIC_AUTH } from '@/config/app.config';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/pages/auth/AuthLayout';

export const route = { path: '/', layout: 'public', access: 'public' };

export default function Welcome() {
  const isAuthenticated = useSelector((s) => s.user.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to={GENERIC_AUTH.redirectAfterAuth} replace />;
  }

  return (
    <AuthLayout title={`Welcome to ${APP_CONFIG.name}`} description={APP_CONFIG.tagline}>
      <div className="flex flex-col gap-2">
        <Button asChild className="w-full h-9">
          <Link to="/signup">Sign up</Link>
        </Button>
        <Button asChild variant="outline" className="w-full h-9">
          <Link to={APP_CONFIG.defaultLoginRoute}>Sign in</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
