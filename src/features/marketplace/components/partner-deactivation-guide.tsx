import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { useMarketplaceEntry } from '@/queries/use-marketplace';

interface PartnerDeactivationGuideProps {
  code: string;
  name: string;
  propertyId: string | undefined;
}

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
