import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateLeaseDraft } from '@/queries/use-lease-draft';
import type { LeaseContractType, LeaseOrigin } from '@/types';
import { LeaseWizardFrame, WIZARD_BUTTON } from './lease-wizard-frame';
import { LeaseWizardStepper } from './lease-wizard-stepper';
import { MissingNote } from './missing-note';
import { PropertyStep } from './property-step';
import { stepWords } from './step-words';
import { emptyFlow, leaseEditPath, registeredSteps, stepKey, visibleSteps } from './wizard-model';

const FIRST_FIELD = 'lw-property';
const NOTHING_TO_LINK = () => '';

export function NewLeaseStep({
  origin,
  contractType,
  defaultPropertyId,
}: {
  origin: LeaseOrigin;
  contractType: LeaseContractType;
  defaultPropertyId?: string;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateLeaseDraft();
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? '');
  const [pressed, setPressed] = useState(0);
  const started = useRef(false);

  const steps = visibleSteps(emptyFlow(origin), registeredSteps(origin));
  const entries = steps.map((step) => ({
    step,
    label: t(`leaseWizard.steps.${stepKey(step, origin)}.label`),
    mark: step === 1 ? ('current' as const) : ('todo' as const),
  }));
  const words = stepWords(t, i18n, 1, origin);
  const focusProperty = () => document.getElementById(FIRST_FIELD)?.focus();

  const submit = async () => {
    if (!propertyId) {
      setPressed((count) => count + 1);
      focusProperty();
      return;
    }
    if (started.current) return;
    started.current = true;
    try {
      const leaseId = await create.mutateAsync({ propertyId, origin, contractType });
      navigate(leaseEditPath(leaseId, 2), { replace: true });
    } catch {
      started.current = false;
    }
  };

  return (
    <LeaseWizardFrame
      stepper={<LeaseWizardStepper entries={entries} current={1} />}
      position={{ current: 1, total: steps.length }}
      title={words.title}
      summary={words.summary}
      inHand={words.inHand}
      footer={
        <>
          <MissingNote
            items={propertyId ? [] : [{ step: 1, need: { code: 'property_missing' } }]}
            current={1}
            pressed={propertyId ? 0 : pressed}
            onGo={focusProperty}
            hrefOfStep={NOTHING_TO_LINK}
          />
          <div className="flex">
            <Button
              type="submit"
              form="lease-new-form"
              loading={create.isPending}
              iconRight={<ArrowRight />}
              className={`${WIZARD_BUTTON} w-full sm:ml-auto sm:w-auto`}
              data-testid="lease-wizard-next"
            >
              {t('leaseWizardGuide.next.to.2')}
            </Button>
          </div>
        </>
      }
    >
      <form
        id="lease-new-form"
        noValidate
        aria-label={words.title}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <PropertyStep value={propertyId} onChange={setPropertyId} imported={origin === 'Imported'} />
      </form>
    </LeaseWizardFrame>
  );
}
