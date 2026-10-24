import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateLeaseDraft } from '@/queries/use-lease-draft';
import type { LeaseContractType, LeaseOrigin } from '@/types';
import { LeaseWizardFrame, WIZARD_BUTTON } from './lease-wizard-frame';
import { LeaseWizardStepper } from './lease-wizard-stepper';
import { PropertyStep } from './property-step';
import { emptyFlow, leaseEditPath, registeredSteps, stepKey, visibleSteps } from './wizard-model';

/**
 * The first step of a contract that does not exist yet (LR-06a): the property. The contract is born at the first «Avanti»: the draft
 * is created on the server with the origin and the type chosen at the start, and the wizard goes on from the second step on that draft
 * (`/leases/:id/edit`). Until then there is nothing to save, so nothing is: leaving costs nothing.
 */
export function NewLeaseStep({
  origin,
  contractType,
  defaultPropertyId,
}: {
  origin: LeaseOrigin;
  contractType: LeaseContractType;
  defaultPropertyId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateLeaseDraft();
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? '');
  const [missing, setMissing] = useState(false);

  const steps = visibleSteps(emptyFlow(origin), registeredSteps(origin));
  const entries = steps.map((step) => ({
    step,
    label: t(`leaseWizard.steps.${stepKey(step, origin)}.label`),
    mark: step === 1 ? ('current' as const) : ('todo' as const),
  }));

  const submit = async () => {
    if (!propertyId) {
      setMissing(true);
      document.getElementById('lw-property')?.focus();
      return;
    }
    try {
      const leaseId = await create.mutateAsync({ propertyId, origin, contractType });
      navigate(leaseEditPath(leaseId, 2), { replace: true });
    } catch {
      // useCreateLeaseDraft.onError says why; the property stays chosen to try again.
    }
  };

  return (
    <LeaseWizardFrame
      stepper={<LeaseWizardStepper entries={entries} current={1} />}
      title={t('leaseWizard.steps.1.title')}
      purpose={t('leaseWizard.steps.1.purpose')}
      why={t('leaseWizard.steps.1.why')}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="submit"
            form="lease-new-form"
            loading={create.isPending}
            iconRight={<ArrowRight />}
            className={`${WIZARD_BUTTON} grow sm:grow-0`}
            data-testid="lease-wizard-next"
          >
            {t('leaseWizard.next', { step: t('leaseWizard.steps.2.label') })}
          </Button>
        </div>
      }
    >
      <form
        id="lease-new-form"
        noValidate
        aria-label={t('leaseWizard.steps.1.title')}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <PropertyStep
          value={propertyId}
          onChange={(id) => {
            setPropertyId(id);
            setMissing(false);
          }}
          error={missing ? 'leaseWizard.validation.property' : undefined}
          imported={origin === 'Imported'}
        />
      </form>
    </LeaseWizardFrame>
  );
}
