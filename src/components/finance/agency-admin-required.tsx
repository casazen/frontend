import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Shown instead of a page of the agency's money (the statements, the withholding, the wire files) to anyone but the owner and the administrators of the
 * organization: the backend gives those pages only to the roles that hold `agency.statement.*`, `agency.withholding.manage` and `agency.wire.manage`. This is the
 * protection of the pages: the role (`isOrgBillingAdmin`) is checked before anything is read, so no endpoint is called for anyone else.
 */
export function AgencyAdminRequired() {
  const { t } = useTranslation();
  return (
    <div role="alert" data-testid="agency-admin-required" className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t('agencyFinance.adminRequired.title')}</p>
        <p className="text-foreground/70">{t('agencyFinance.adminRequired.description')}</p>
      </div>
    </div>
  );
}
