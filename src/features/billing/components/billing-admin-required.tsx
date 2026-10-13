import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Shown instead of the plan and billing pages to anyone but the org billing administrator (spec-saas-billing AC13). */
export function BillingAdminRequired() {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-testid="billing-admin-required"
      className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t('billing.adminRequired.title')}</p>
        <p className="text-muted-foreground">{t('billing.adminRequired.description')}</p>
      </div>
    </div>
  );
}
