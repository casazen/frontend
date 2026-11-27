import { useTranslation } from 'react-i18next';
import { ExternalLink, Landmark } from 'lucide-react';
import { InfoCard } from '@/components/shared/calm';
import { ManualHint } from '@/components/shared/manual-hint';
import { Button } from '@/components/ui/button';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { GuestRegistrationCard } from './guest-registration-card';

interface SwissRegistrationGuidanceProps {
  propertyId: string;
  /**
   * `page`: the tab of the property (the link to the official portal opens from the card, in a new tab). `wizard`: a step in progress, which never leaves the process: no link
   * out of it.
   */
  variant?: 'page' | 'wizard';
  /** `property.write`: the answer and the structure number can be changed. */
  canWrite?: boolean;
  /** A wizard sends the host to its own step where the municipality is set. */
  onFixMunicipality?: () => void;
  /** A page opens the form of the property, where the municipality is set. */
  municipalityHref?: string;
  /** After the structure number is saved (a wizard reads its steps again). */
  onChanged?: () => void;
  className?: string;
}

export function SwissRegistrationGuidance({ propertyId, variant = 'page', canWrite = false, onFixMunicipality, municipalityHref, onChanged, className }: SwissRegistrationGuidanceProps) {
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
        className={className}
      />
    );
  }

  return (
    <InfoCard
      icon={Landmark}
      title={t('property.swissRegistration.title')}
      hint={
        <ManualHint page="cin-identificazione-ticino" anchor="svizzera-e-ticino-notifica-degli-ospiti" title={t('property.swissRegistration.title')}>
          {t('property.swissRegistration.description')} {t('property.swissRegistration.ticino')}
        </ManualHint>
      }
      className={className}
    >
      <div>
        <Button asChild variant="outline" size="sm">
          <a href="https://www.ticino.ch/it/partners/alloggi/notifica-numero-identificativo.html" target="_blank" rel="noopener noreferrer">
            {t('property.swissRegistration.link')}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </Button>
      </div>
    </InfoCard>
  );
}
