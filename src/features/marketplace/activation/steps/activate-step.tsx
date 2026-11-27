import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { WizardSummary } from '@/components/shared/wizard/wizard-summary';
import { ACTIVATION_STEP, propertyNameOf, type ActivationContext, type ActivationWizardValues } from '../activation-wizard-model';
import { ChoosePropertyFirst } from './choose-property-first';

interface ActivateStepProps {
  context: ActivationContext;
  onChoose: () => void;
}

/**
 * Step «Attivazione» (E09/F02/US04/T02, UX-05): before the action that has effects outside CasaZen, a summary in simple words of what will happen, where and when
 * («we will connect the channel for this property; its bookings and availability will flow both ways»), with «Modifica» that goes back to the rooms. The button of the
 * step is the last one of the wizard: it activates each property in its turn (`POST .../activate`).
 */
export function ActivateStep({ context, onChoose }: ActivateStepProps) {
  const { t } = useTranslation();
  const { control } = useFormContext<ActivationWizardValues>();
  const propertyIds = useWatch({ control, name: 'propertyIds' }) ?? [];
  const name = context.channelName ?? t('marketplace.activation.thisChannel');

  if (propertyIds.length === 0) return <ChoosePropertyFirst onChoose={onChoose} />;

  return (
    <div className="flex flex-col gap-4" data-testid="activation-activate-step">
      <p className="text-sm text-muted-foreground">{t('marketplace.activation.activate.intro')}</p>
      <WizardSummary
        items={propertyIds.map((propertyId) => {
          const property = propertyNameOf(context.properties, propertyId) ?? propertyId;
          return {
            id: propertyId,
            label: property,
            value: t('marketplace.activation.activate.summary', { name, property }),
            stepId: ACTIVATION_STEP.mapping,
          };
        })}
      />
      <p className="rounded-lg bg-muted p-4 text-sm" data-testid="activation-activate-when">
        {t('marketplace.activation.activate.when', { name })}
      </p>
    </div>
  );
}
