import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { useBillingSetup } from '@/queries/use-billing-setup';
import { BILLING_SETUP_PATH } from '@/features/fiscal/billing-wizard/billing-wizard-ids';
import { billingItemTextKey, billingStepOfItem } from '@/lib/onboarding-billing';
import { SETUP_RETURN_PARAM, billingIdentityComplete } from '../property-setup-model';

export function BillingSetupStep({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const setup = useBillingSetup();
  if (setup.isError) return <ErrorState title={t('propertySetup.loadError')} error={setup.error} onRetry={() => void setup.refetch()} />;
  if (!setup.data) return <p role="status">{t('propertySetup.loading')}</p>;
  const complete = billingIdentityComplete(setup.data);
  const missing = setup.data.sections.filter(section => ['issuer', 'vat'].includes(section.section) && section.applies).flatMap(section => section.missing);
  const step = missing[0] ? billingStepOfItem(missing[0]) : null;
  const query = new URLSearchParams({ [SETUP_RETURN_PARAM]: propertyId, ...(step ? { step } : {}) });
  return <section className="max-w-xl space-y-5 rounded-2xl border bg-card p-6" data-testid="property-setup-billing">
    <Receipt className="size-7 text-primary" aria-hidden="true" />
    <h2 className="text-xl font-semibold">{t('propertySetup.billing.title')}</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">{t('propertySetup.billing.text')}</p>
    <p className="rounded-xl bg-muted p-4 text-sm" role="status">{t(complete ? 'propertySetup.billing.saved' : 'propertySetup.billing.missing')}</p>
    {missing.length > 0 && <ul className="space-y-2 text-sm">{missing.map(item => <li key={item.key}>{t(billingItemTextKey(item.key))}</li>)}</ul>}
    <Button asChild variant={complete ? 'outline' : 'default'}><Link to={`${BILLING_SETUP_PATH}?${query}`} data-testid="property-setup-open-billing">{t(complete ? 'propertySetup.review' : 'propertySetup.configure')}<ArrowRight className="size-4" /></Link></Button>
    <p className="text-xs text-muted-foreground">{t('propertySetup.returnHint')}</p>
  </section>;
}
