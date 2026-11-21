import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GuestRegistrationCard } from '@/features/properties/components/guest-registration-card';
import { GuestRegistrationReadiness } from '@/features/properties/components/guest-registration-readiness';
import { missingCodesOf } from '@/features/properties/lib/guest-registration-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import type { ComplianceWizardStep } from '@/types/compliance.types';

interface GuestRegistrationStepProps {
  propertyId: string;
  /** The step as the server says it now: what it lists as missing is what the panel asks for while the regimes are off. */
  step: ComplianceWizardStep;
  /** The property is in Ticino: its notification starts with the structure number, so the field is here. */
  ticino: boolean;
  /** Goes to the step of the wizard where the municipality is set: the host never leaves the process. */
  onFixMunicipality: () => void;
  /** After the structure number is saved: the wizard reads its steps again. */
  onChanged: () => void;
  /** The step the host came from, when it is another step of the wizard: the way back to it. */
  origin: { id: string; title: string } | null;
  onBackToOrigin: () => void;
}

/**
 * The step «Notifica degli ospiti» of the activation of a property in Switzerland (E29/F02/US02/T01, NF-125, NF-129), inside the wizard: nothing here sends the host out of it.
 * With the flag `guestRegistrationRegimes` on it is the card of the regime of the canton; with it off it is what the step lists as missing (the municipality, in Ticino the
 * structure number), because that rule does not depend on the flag. It is kept mounted while another step is shown, so what was typed survives going back and forth, and the way
 * back to the step the host came from is always at hand.
 */
export function GuestRegistrationStep({ propertyId, step, ticino, onFixMunicipality, onChanged, origin, onBackToOrigin }: GuestRegistrationStepProps) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const missing = missingCodesOf(step.blockers?.map((blocker) => blocker.code));

  return (
    <div className="space-y-4" data-testid="guest-registration-step">
      {flags.guestRegistrationRegimes ? (
        <GuestRegistrationCard propertyId={propertyId} variant="wizard" canWrite onFixMunicipality={onFixMunicipality} onChanged={onChanged} />
      ) : (
        <div className="space-y-3" data-testid="guest-registration-step-basics">
          <p className="text-sm text-foreground/70">{t('guestRegistration.step.intro')}</p>
          {missing.length === 0 ? <p className="text-sm" data-testid="guest-registration-step-complete">{t('guestRegistration.step.complete')}</p> : null}
          <GuestRegistrationReadiness
            propertyId={propertyId}
            missing={missing}
            ticino={ticino}
            canWrite
            onFixMunicipality={onFixMunicipality}
            onSaved={onChanged}
          />
        </div>
      )}

      {origin ? (
        <div>
          <Button type="button" variant="outline" onClick={onBackToOrigin} data-testid="guest-registration-back-to-origin">
            <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
            {t('compliance.activation.backToStep', { step: origin.title })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
