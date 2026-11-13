import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import type { PropertySender } from '@/types';
import {
  SENDER_STEP,
  confirmationOf,
  consentGiven,
  isAutomaticSender,
  switchKind,
  type SenderWizardValues,
} from '../sender-wizard-model';
import { useSenderPropertyName } from '../use-sender-property-name';

interface SenderSummaryStepProps {
  read: PropertySender;
}

/**
 * Step «Riepilogo» (NF-05): what will change, before it changes. The summary lists who will send, that ISTAT follows and the state of the delegation, each with the link that goes back to
 * its answer; when the sender really changes it says what goes off and asks the host to confirm that change (the server asks it too: 409 `sender_switch_confirmation_required`).
 * Nothing is sent to the server until the button of this step.
 */
export function SenderSummaryStep({ read }: SenderSummaryStepProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<SenderWizardValues>();
  const values = useWatch({ control }) as SenderWizardValues;
  const kind = switchKind(read.sender, values.sender);
  const automatic = isAutomaticSender(values.sender);
  const token = confirmationOf(read.sender, values.sender);
  // The change is about one property: the summary says which (its name is read after the sender, so only for a property the caller reaches).
  const propertyName = useSenderPropertyName(read.propertyId, true);

  let delegation: string | null = null;
  if (!automatic) delegation = t('compliance.sender.summary.delegation.notNeeded');
  else if (read.delegationAccepted) delegation = t('compliance.sender.summary.delegation.accepted');
  else if (consentGiven(values, read)) delegation = t('compliance.sender.summary.delegation.toRecord');

  const items: WizardSummaryItem[] = [
    ...(propertyName ? [{ id: 'property', label: t('compliance.sender.summary.property'), value: propertyName }] : []),
    {
      id: 'sender',
      label: t('compliance.sender.summary.who'),
      value: values.sender ? t(`compliance.sender.choice.options.${values.sender}.title`) : null,
      stepId: SENDER_STEP.choice,
    },
    { id: 'istat', label: t('compliance.sender.summary.istat'), value: t('compliance.sender.summary.istatFollows') },
    { id: 'delegation', label: t('compliance.sender.summary.delegation.label'), value: delegation, stepId: automatic ? SENDER_STEP.choice : undefined },
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="sender-summary-step">
      <WizardSummary items={items} />

      {kind !== 'same' ? (
        <section className="min-w-0 space-y-3" data-testid="sender-switch-confirmation" aria-labelledby="sender-switch-title">
          <Alert variant="warning" title={t('compliance.sender.summary.switch.title')} id="sender-switch-title">
            {t(`compliance.sender.summary.switch.${kind}`)}
          </Alert>
          <div className="flex items-center gap-3">
            <Checkbox
              id="sender-switch-confirmed"
              checked={values.switchConfirmed === token}
              onCheckedChange={(checked) => setValue('switchConfirmed', checked === true ? token : '', { shouldDirty: true, shouldTouch: true })}
              data-testid="sender-switch-confirmed"
            />
            {/* The label is the target to press: at least 44 px high, the whole line. */}
            <Label htmlFor="sender-switch-confirmed" className="flex min-h-11 flex-1 cursor-pointer items-center break-words text-sm font-medium leading-snug">
              {t('compliance.sender.summary.switch.confirm')}
            </Label>
          </div>
        </section>
      ) : (
        <p className="break-words text-sm text-foreground/70" data-testid="sender-switch-none">
          {t('compliance.sender.summary.switch.same')}
        </p>
      )}
    </div>
  );
}
