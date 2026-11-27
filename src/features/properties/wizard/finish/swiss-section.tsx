import { useQueryClient } from '@tanstack/react-query';
import { GuestRegistrationReadiness } from '@/features/properties/components/guest-registration-readiness';
import { SwissRegistrationGuidance } from '@/features/properties/components/swiss-registration-guidance';
import { missingCodesOf } from '@/features/properties/lib/guest-registration-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { usePropertyDetail } from '@/queries/use-properties';
import type { ComplianceWizardStep } from '@/types/compliance.types';

interface SwissSectionProps {
  propertyId: string;
  step: ComplianceWizardStep | undefined;
}

/**
 * The notification of the guests of a property in Switzerland, in the last step of «Aggiungi immobile» (E29/F02/US02/T01): where the CIN is for a property in Italy. With the flag
 * `guestRegistrationRegimes` on it is the card of the regime of the canton; with it off it is the general guidance it always was. What a Swiss property lacks (its municipality, in
 * Ticino its structure number) blocks its activation whatever the flag says, so with the flag off the section lists it too and has the field of the number: «Correggi» of «Cosa manca»
 * puts the focus here (`fixTargetFor`), and the host never meets a blocker that this step has no place for.
 */
export function SwissSection({ propertyId, step }: SwissSectionProps) {
  const { flags } = useFeatureFlags();

  return (
    <div id="property-wizard-section-guest-registration" tabIndex={-1} className="min-w-0 space-y-4 outline-none" data-testid="property-wizard-swiss">
      <SwissRegistrationGuidance propertyId={propertyId} variant="wizard" canWrite />
      {flags.guestRegistrationRegimes ? null : <WhatASwissPropertyLacks propertyId={propertyId} step={step} />}
    </div>
  );
}

function WhatASwissPropertyLacks({ propertyId, step }: SwissSectionProps) {
  const queryClient = useQueryClient();
  const detail = usePropertyDetail(propertyId);

  return (
    <GuestRegistrationReadiness
      propertyId={propertyId}
      missing={missingCodesOf(step?.blockers?.map((blocker) => blocker.code))}
      ticino={detail.data?.isInTicino === true}
      canWrite
      onSaved={() => void queryClient.invalidateQueries({ queryKey: ['compliance', 'activation', propertyId] })}
    />
  );
}
