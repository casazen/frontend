import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { needsOnboarding } from '@/lib/onboarding';
import { useMe } from '@/queries/use-users';

export function OnboardingGuard() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMe();

  if (authLoading || (isAuthenticated && profileLoading)) {
    return <LoadingScreen message="Caricamento..." />;
  }

  if (isAuthenticated && needsOnboarding(user, profile)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
