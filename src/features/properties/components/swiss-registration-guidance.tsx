import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { GuestRegistrationCard } from './guest-registration-card';

interface SwissRegistrationGuidanceProps {
  propertyId: string;
  variant?: 'page' | 'wizard';
  canWrite?: boolean;
  onFixMunicipality?: () => void;
  municipalityHref?: string;
  onChanged?: () => void;
}

/**
 * What a property in Switzerland says about the notification of its guests, wherever it is told (the tab of the property, the activation, the last step of «Aggiungi
 * immobile»). With the flag `guestRegistrationRegimes` on it is the card of the regime of the canton (`GuestRegistrationCard`, E29/F02/US02/T01); with it off it is the
 * general guidance it always was, and nothing is asked of the server. Cantonal obligations stay distinct from the Italian CIN; CasaZen does not certify their fulfilment.
 */
export function SwissRegistrationGuidance({ propertyId, variant = 'page', canWrite = false, onFixMunicipality, municipalityHref, onChanged }: SwissRegistrationGuidanceProps) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();

  if (flags.guestRegistrationRegimes) {
    return (
      <GuestRegistrationCard
        propertyId={propertyId}
        variant={variant}
        canWrite={canWrite}
        onFixMunicipality={onFixMunicipality}
        municipalityHref={municipalityHref}
        onChanged={onChanged}
      />
    );
  }

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
