import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';

/**
 * Shown instead of the pages of the owner accounting to anyone but the owner and the administrators of the organization (they hold the finance permissions, and the whole reach of
 * the organization that the owner accounting spans). This is the protection of the pages: the role (`isOrgBillingAdmin`) is checked before anything is read, so no endpoint is
 * called for anyone else.
 */
export function FinanceAdminRequired() {
  const { t } = useTranslation();
  return (
    <div role="alert" data-testid="finance-admin-required" className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t('ownerAccounting.adminRequired.title')}</p>
        <p className="text-foreground/70">{t('ownerAccounting.adminRequired.description')}</p>
      </div>
    </div>
  );
}

interface OwnerAccountingErrorProps {
  error: unknown;
  title: string;
  onRetry: () => void;
}

export function OwnerAccountingError({ error, title, onRetry }: OwnerAccountingErrorProps) {
  return <ErrorState title={title} error={error} onRetry={onRetry} testId="owner-accounting-error" />;
}
