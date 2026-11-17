import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { useSender } from '@/queries/use-property-sender';
import { senderWizardHref } from '@/features/compliance/sender-wizard/sender-wizard-model';
import { SETUP_RETURN_PARAM, senderChoiceSaved } from '../property-setup-model';

export function ComplianceSetupStep({ propertyId, country }: { propertyId: string; country: string }) {
  const { t } = useTranslation();
  // Do not call the Italian sender API for a Swiss (or as yet unknown) address.
  const sender = useSender(propertyId, country === 'IT');
  if (country !== 'IT') return <section className="max-w-xl space-y-4 rounded-2xl border bg-card p-6" data-testid="property-setup-local">
    <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
    <h2 className="text-xl font-semibold">{t('propertySetup.compliance.localTitle')}</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">{t('propertySetup.compliance.localText')}</p>
    <p className="rounded-xl bg-muted p-4 text-sm">{t('propertySetup.compliance.localPending')}</p>
  </section>;
  if (sender.isError || sender.data === null) return <ErrorState title={t('propertySetup.loadError')} error={sender.error} onRetry={() => void sender.refetch()} />;
  if (!sender.data) return <p role="status">{t('propertySetup.loading')}</p>;
  const saved = senderChoiceSaved(sender.data);
  const to = `${senderWizardHref(propertyId)}&${SETUP_RETURN_PARAM}=${encodeURIComponent(propertyId)}`;
  return <section className="max-w-xl space-y-5 rounded-2xl border bg-card p-6" data-testid="property-setup-compliance">
    <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
    <h2 className="text-xl font-semibold">{t('propertySetup.compliance.title')}</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">{t('propertySetup.compliance.text')}</p>
    <p className="rounded-xl bg-muted p-4 text-sm" role="status">{t(saved ? 'propertySetup.compliance.saved' : 'propertySetup.compliance.missing')}</p>
    {sender.data.guidance && <p className="text-sm text-muted-foreground">{sender.data.guidance}</p>}
    <Button asChild variant={saved ? 'outline' : 'default'}><Link to={to} data-testid="property-setup-open-sender">{t(saved ? 'propertySetup.review' : 'propertySetup.configure')}<ArrowRight className="size-4" /></Link></Button>
    <p className="text-xs text-muted-foreground">{t('propertySetup.returnHint')}</p>
  </section>;
}
