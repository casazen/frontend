import { Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { useUserRoles } from '@/hooks/use-user-roles';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { needsOnboarding } from '@/lib/onboarding';
import { useMe } from '@/queries/use-users';

export function OnboardingGuard() {
  const { t } = useTranslation();
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const roles = useUserRoles();
  const { data: profile, isLoading: profileLoading, isError: profileError } = useMe();

  if (authLoading || (isAuthenticated && profileLoading && !profile)) {
    return <LoadingScreen message={t('shared.loading.defaultMessage')} />;
  }

  if (isAuthenticated && profileError && !profile) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isAuthenticated && needsOnboarding(user, profile, roles)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
