import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';

/** Cantonal obligations stay distinct from the Italian CIN; CasaZen does not certify their fulfilment. */
export function SwissRegistrationGuidance() {
  const { t } = useTranslation();
  return (
    <PlainSection title={t('property.swissRegistration.title')}>
      <p className="text-sm text-foreground/70">{t('property.swissRegistration.description')}</p>
      <p className="mt-2 text-sm text-foreground/70">{t('property.swissRegistration.ticino')}</p>
      <a href="https://www.ticino.ch/it/partners/alloggi/notifica-numero-identificativo.html" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline">
        {t('property.swissRegistration.link')}<ExternalLink aria-hidden="true" className="size-4" />
      </a>
    </PlainSection>
  );
}
