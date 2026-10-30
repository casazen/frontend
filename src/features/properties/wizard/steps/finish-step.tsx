import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { IcalSettings } from '@/features/properties/components/ical-settings';
import { useProperty } from '@/queries/use-properties';
import type { ActivationBlocker, ComplianceActivationResult } from '@/types/compliance.types';
import { ActivationSection } from '../finish/activation-section';
import { CinSection } from '../finish/cin-section';
import { DocumentsSection } from '../finish/documents-section';
import { finishStage } from '../finish/finish-model';
import { MissingSection } from '../finish/missing-section';
import { SummarySection } from '../finish/summary-section';
import type { PropertyWizardValues } from '../property-wizard-model';

interface FinishStepProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
  /** The activation as the server answers it now (read again after every save); the wizard keeps it, the button of the footer needs it too. */
  activation: ComplianceActivationResult | undefined;
  activationFailed: boolean;
  onRetryActivation: () => void;
  /** Blockers of the last refused attempt to activate (409), if any. */
  refused: readonly ActivationBlocker[] | null;
  tosAccepted: boolean;
  onTosChange: (accepted: boolean) => void;
}

/**
 * Step 6 · «Calendari, CIN e attivazione» (SR-07c): the calendars, the CIN and the documents of the region — each saved on its own, with
 * what is missing read again from the server — then the summary with «Modifica» for each section, «Mostra la casa sul sito» and the
 * terms. The main button of the wizard activates when nothing blocks, and otherwise says «Finisci dopo»: the property stays «Da
 * completare». Nothing here publishes a property that the server says is not ready.
 */
export function FinishStep({ form, propertyId, activation, activationFailed, onRetryActivation, refused, tosAccepted, onTosChange }: FinishStepProps) {
  const { t } = useTranslation();
  const property = useProperty(propertyId, { fresh: true });
  const steps = activation?.steps;
  const stage = finishStage(activation);

  return (
    <>
      <details id="property-wizard-section-calendars" className="group min-w-0" data-testid="property-wizard-calendars">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-base font-semibold">{t('propertyWizard.last.calendars.title')}</span>
            <span className="block text-sm font-normal text-foreground/70">{t('propertyWizard.last.calendars.hint')}</span>
          </span>
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="pt-3">
          <IcalSettings propertyId={propertyId} />
        </div>
      </details>

      <CinSection
        propertyId={propertyId}
        storedCin={property.data?.cinCode ?? null}
        guidanceUrl={steps?.find((step) => step.id === 'cin')?.linkUrl}
      />

      <DocumentsSection propertyId={propertyId} step={steps?.find((step) => step.id === 'documents')} />

      <MissingSection steps={steps} failed={activationFailed} onRetry={onRetryActivation} property={property.data} refused={refused} />

      <SummarySection property={property.data} steps={steps} />

      <ActivationSection form={form} stage={stage} tosAccepted={tosAccepted} onTosChange={onTosChange} />
    </>
  );
}
