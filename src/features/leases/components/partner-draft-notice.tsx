import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

/**
 * The one thing a canone concordato draft waits for: the contract of the partner (ConcordatoFacile). The single entry point to the
 * partner's service is the button «Procedi con la creazione del contratto». With the service on (`concordatoFacile`, CF-FIX) it
 * opens the page of the service for this contract (payment or gift, then the signed link to the partner's form) and the line under
 * it says what happens; while the service is off the button is shown disabled, with what to do meanwhile: give the partner the
 * reference of the contract.
 */
export function PartnerDraftNotice({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const titleId = useId();
  const live = flags.concordatoFacile;
  return (
    <section aria-labelledby={titleId} data-testid="lease-partner-draft" className="space-y-3 rounded-lg bg-primary/5 p-4 ring-1 ring-primary/30">
      <h2 id={titleId} className="text-lg font-semibold">
        {t('leases.partnerDraft.title')}
      </h2>
      <p className="text-sm">{t('leases.partnerDraft.description')}</p>
      {live ? (
        <Button asChild data-testid="lease-partner-proceed">
          <Link to={`/app/long-rent/leases/${leaseId}/concordatofacile`}>{t('leases.partnerDraft.proceed')}</Link>
        </Button>
      ) : (
        <Button type="button" disabled data-testid="lease-partner-proceed">
          {t('leases.partnerDraft.proceed')}
        </Button>
      )}
      <p className="text-sm text-foreground/70">{live ? t('leases.partnerDraft.ready') : t('leases.partnerDraft.soon')}</p>
    </section>
  );
}
