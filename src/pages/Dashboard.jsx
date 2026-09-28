import { Navigate } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { Card, CardContent } from '@/components/ui/card';
import {
  addressUser,
  getPersonalizedGreeting,
  getTimeOfDayGreeting,
  usePreferredName,
} from '@/personalization';

export const route = { path: '/dashboard', layout: 'owner', access: 'authenticated' };

export default function Dashboard() {
  const { preferredName, hasPreferredName, isLoading } = usePreferredName();

  if (isLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPreferredName) {
    return <Navigate to="/onboarding/name" replace />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-24 pb-12">
      <p className="text-sm text-muted-foreground">{getTimeOfDayGreeting()}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {getPersonalizedGreeting(preferredName)}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your subscriptions. One place. Always on track.
      </p>

      <Card className="mt-8">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <ApperIcon name="Inbox" size={22} className="text-primary" />
          </div>
          <h2 className="text-base font-semibold">No subscriptions yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {addressUser(
              preferredName,
              "Once your subscriptions sync, they'll show up here along with what's renewing next.",
            )}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
