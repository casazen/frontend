import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { getHttpStatus } from '@/lib/api-errors';

/** Shown instead of the pages of the owner accounting to anyone but the owner and the administrators of the organization (they hold the finance permissions). */
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
  /** What failed to load, in words ("Non riusciamo a leggere la chiusura del mese"). */
  title: string;
  onRetry: () => void;
}

/**
 * A page of the owner accounting that could not load. A 403 is not a failure to try again: the owner accounting spans every property of the
 * organization, so it is refused to who is restricted to some of them and to who lacks the finance permission, and the page says that.
 */
export function OwnerAccountingError({ error, title, onRetry }: OwnerAccountingErrorProps) {
  const { t } = useTranslation();
  if (getHttpStatus(error) === 403) {
    return (
      <div role="alert" data-testid="owner-accounting-no-access" className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{t('ownerAccounting.noReach.title')}</p>
          <p className="text-foreground/70">{t('ownerAccounting.noReach.description')}</p>
        </div>
      </div>
    );
  }
  return <ErrorState title={title} error={error} onRetry={onRetry} testId="owner-accounting-error" />;
}
