import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { useUserRoleState } from '@/hooks/use-user-roles';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ProfileLoadError } from '@/components/auth/profile-load-error';
import { isLinkedSupplier, isProfileLoadFailure, needsOnboarding } from '@/lib/onboarding';
import { readPendingSupplierClaim, SUPPLIER_CLAIM_PATH } from '@/lib/supplier-claim';
import { useMe } from '@/queries/use-users';
import { isAccountInactiveError } from '@/lib/api-errors';
import { ACCOUNT_INACTIVE_PATH } from '@/lib/axios';
import { useSignupAttributionSync } from '@/hooks/use-signup-attribution-sync';

/**
 * Sends to `/onboarding` only the users who need it (A1-01): hosts without an org or without a completed
 * onboarding. Platform admins and supplier-only users pass without an org, and so does an account linked to a supplier
 * profile (`supplierOrgId`, SU-02) even before the Supplier role reaches its token. A supplier who registered without
 * an account and still holds the claim token goes to `/register/claim` first (A4-02). A failed profile load is shown
 * as an error with retry, never as "not onboarded" (A1-19).
 */
export function OnboardingGuard() {
  const { t } = useTranslation();
  const location = useLocation();
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const { roles, isResolved: rolesResolved } = useUserRoleState();
  const { data: profile, isLoading: profileLoading, error: profileError, refetch, isFetching } = useMe();
  const passes =
    !authLoading &&
    isAuthenticated &&
    !!profile &&
    rolesResolved &&
    !needsOnboarding(user, profile, roles);
  // SE-03: a signup attribution is sent (or forgotten) only once the user is past the onboarding.
  useSignupAttributionSync(passes);

  // The decision depends on the absence of roles (e.g. "not an admin"): wait until they are known.
  if (authLoading || (isAuthenticated && ((profileLoading && !profile) || !rolesResolved))) {
    return <LoadingScreen message={t('shared.loading.defaultMessage')} />;
  }

  // Deactivated account (PL-03): the dedicated page, never the profile error with a retry that would fail again.
  if (isAuthenticated && isAccountInactiveError(profileError)) {
    return <Navigate to={ACCOUNT_INACTIVE_PATH} replace />;
  }

  if (isAuthenticated && !profile && isProfileLoadFailure(profileError)) {
    return <ProfileLoadError error={profileError} onRetry={() => void refetch()} isRetrying={isFetching} />;
  }

  if (isAuthenticated && !isLinkedSupplier(profile) && readPendingSupplierClaim()) {
    return <Navigate to={SUPPLIER_CLAIM_PATH} replace />;
  }

  if (isAuthenticated && needsOnboarding(user, profile, roles)) {
    return <Navigate to="/onboarding" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}
