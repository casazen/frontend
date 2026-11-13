import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { useMarketplaceEntry } from '@/queries/use-marketplace';

interface PartnerDeactivationGuideProps {
  /** The code of the partner. */
  code: string;
  name: string;
  /** The property the activation is for: the card is read for it. */
  propertyId: string | undefined;
}

/**
 * How to turn a partner off on the partner's own site (E09/F03/US02/T02, MKT-05, AC-NF58-4): the instructions the card of the partner carries (`deactivation.text`), word for
 * word. CasaZen turns nothing off at a partner, so the step after this one is the host's: «I did it». The instructions are not a condition of that step: a partner whose text cannot be read
 * still says so, and the host who already knows how may go on.
 */
export function PartnerDeactivationGuide({ code, name, propertyId }: PartnerDeactivationGuideProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const entry = useMarketplaceEntry('Partner', code, propertyId);
  const text = entry.data?.deactivation.text.trim() ?? '';

  return (
    <section aria-labelledby={titleId} className="space-y-1.5" data-testid="deactivate-partner-guide">
      <h3 id={titleId} className="text-sm font-semibold">
        {t('marketplace.deactivate.partner.stepsTitle', { name })}
      </h3>
      {entry.isError ? (
        // A 404 is «not found» whatever the cache still holds of an older read (the query keeps the last data on an error).
        getHttpStatus(entry.error) === 404 ? (
          <p className="text-sm text-muted-foreground" data-testid="deactivate-partner-guide-not-found">
            {t('marketplace.deactivate.partner.notFound')}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2" role="alert" data-testid="deactivate-partner-guide-error">
            <p className="text-sm">{t('marketplace.deactivate.partner.readError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void entry.refetch()}>
              {t('marketplace.deactivate.retry')}
            </Button>
          </div>
        )
      ) : entry.data ? (
        <p className="whitespace-pre-line break-words text-sm text-foreground/80" data-testid="deactivate-partner-guide-text">
          {text || t('marketplace.deactivate.partner.noText')}
        </p>
      ) : (
        <SkeletonLine lines={2} label={t('marketplace.deactivate.partner.loading')} />
      )}
    </section>
  );
}
