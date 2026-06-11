import { useCurrentUser } from '@/queries/use-users';
import type { UserRole } from '@/types';
import { LoadingScreen } from '@/components/shared/loading-screen';

const BLOCKED_ROLES: UserRole[] = ['Staff', 'Guest'];

const NON_ADMIN_MESSAGE =
  "Per gestire la fatturazione, contatta l'amministratore dell'organizzazione.";

function isOrgBillingAdmin(role: UserRole | undefined, orgId: string | null | undefined): boolean {
  if (!orgId || !role) return false;
  return !BLOCKED_ROLES.includes(role);
}

interface RequireOrgBillingAdminProps {
  children: React.ReactNode;
}

export function RequireOrgBillingAdmin({ children }: RequireOrgBillingAdminProps) {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  if (!isOrgBillingAdmin(user?.role, user?.orgId)) {
    return (
      <div
        className="mx-auto max-w-lg px-4 py-16 text-center"
        data-testid="billing-admin-denied"
      >
        <p className="text-muted-foreground">{NON_ADMIN_MESSAGE}</p>
      </div>
    );
  }

  return <>{children}</>;
}
