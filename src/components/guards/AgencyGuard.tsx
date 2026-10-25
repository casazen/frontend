import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useOrg } from '@/hooks/useOrg';

interface AgencyGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard that requires Agency tier (ADR-010-R6).
 * Redirects to dashboard with a toast message if the org is not on Agency tier.
 */
export function AgencyGuard({ children }: AgencyGuardProps) {
  const { t } = useTranslation();
  const { isAgency, isLoading } = useOrg();

  useEffect(() => {
    if (!isLoading && !isAgency) {
      toast.error(t('org.tier.requires_agency'));
    }
  }, [isAgency, isLoading, t]);

  if (isLoading) {
    return null;
  }

  if (!isAgency) {
    return <Navigate to="/app/short-rent/dashboard" replace />;
  }

  return <>{children}</>;
}
