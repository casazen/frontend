import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/**
 * The one thing a canone concordato draft waits for: the contract of the partner (ConcordatoFacile). The single entry point to the
 * partner's service is the button «Procedi con la creazione del contratto»; until the connection is live (the payment and the
 * signed link are being built) it is shown, disabled, with what to do meanwhile: give the partner the reference of the contract.
 */
export function PartnerDraftNotice() {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} data-testid="lease-partner-draft" className="space-y-3 rounded-lg bg-primary/5 p-4 ring-1 ring-primary/30">
      <h2 id={titleId} className="text-lg font-semibold">
        {t('leases.partnerDraft.title')}
      </h2>
      <p className="text-sm">{t('leases.partnerDraft.description')}</p>
      <Button type="button" disabled data-testid="lease-partner-proceed">
        {t('leases.partnerDraft.proceed')}
      </Button>
      <p className="text-sm text-foreground/70">{t('leases.partnerDraft.soon')}</p>
    </section>
  );
}
