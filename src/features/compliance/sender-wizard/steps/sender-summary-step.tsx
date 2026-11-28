import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { useIstatClaim } from '@/features/compliance/lib/use-istat-claim';
import type { PropertySender } from '@/types';
import {
  SENDER_STEP,
  autoSendAsked,
  autoSendInForce,
  autoSendShown,
  confirmationOf,
  consentGiven,
  isAutomaticSender,
  switchKind,
  type SenderWizardValues,
} from '../sender-wizard-model';
import { useSenderPropertyName } from '../use-sender-property-name';

interface AutoSendSettingProps {
  read: PropertySender;
  canChange: boolean;
  busy: boolean;
}

/**
 * «Invia gli ospiti da solo quando i dati sono completi e l'identità è verificata» (E20/F01/US02, decision O1): the setting of the whole organization that lets CasaZen write the
 * guests to the channel manager without waiting for the host to confirm the check-in. It is off unless the organization turned it on, and the sentence under it says what the
 * state on screen means; the change is sent with the button of the step, like the sender, and the wizard stays where it is. Only the organization administrator can change it. Until
 * the person touches the switch it shows the setting as the server holds it now and nothing about it is sent.
 */
function AutoSendSetting({ read, canChange, busy }: AutoSendSettingProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<SenderWizardValues>();
  const chosen = useWatch({ control, name: 'autoSendGuests' });
  const on = canChange ? autoSendShown({ autoSendGuests: chosen }, read) : autoSendInForce(read);
  const state = on ? 'on' : 'off';

  return (
    <section className="min-w-0 space-y-1" data-testid="sender-auto-send" data-state={state}>
      {canChange ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium leading-snug" htmlFor="sender-auto-send-switch">
          <Switch
            id="sender-auto-send-switch"
            checked={on}
            disabled={busy}
            onCheckedChange={(checked) => setValue('autoSendGuests', checked, { shouldDirty: true, shouldTouch: true })}
            aria-describedby="sender-auto-send-consequence"
            data-testid="sender-auto-send-switch"
          />
          <span className="min-w-0 break-words">{t('compliance.sender.autoSend.label')}</span>
        </label>
      ) : (
        <p className="break-words text-sm font-medium" data-testid="sender-auto-send-readonly">
          {t(`compliance.sender.autoSend.readOnly.${state}`)}
        </p>
      )}
      <p id="sender-auto-send-consequence" className="break-words text-sm text-foreground/70" data-testid="sender-auto-send-consequence">
        {t(`compliance.sender.autoSend.consequence.${state}`)}
      </p>
      {canChange ? null : <p className="break-words text-sm text-foreground/70">{t('compliance.sender.autoSend.adminOnly')}</p>}
    </section>
  );
}

interface SenderSummaryStepProps {
  read: PropertySender;
  canChangeAutoSend?: boolean;
  busy?: boolean;
}

/**
 * Step «Riepilogo» (NF-05): what will change, before it changes. The summary lists who will send, that ISTAT follows and the state of the delegation, each with the link that goes back to
 * its answer; when the sender really changes it says what goes off and asks the host to confirm that change (the server asks it too: 409 `sender_switch_confirmation_required`).
 * With the channel manager as the sender it also holds the setting of the organization «Invia gli ospiti da solo…» (`AutoSendSetting`). Nothing is sent to the server until the
 * button of this step.
 */
export function SenderSummaryStep({ read, canChangeAutoSend = false, busy = false }: SenderSummaryStepProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<SenderWizardValues>();
  const values = useWatch({ control }) as SenderWizardValues;
  const kind = switchKind(read.sender, values.sender);
  const automatic = isAutomaticSender(values.sender);
  const token = confirmationOf(read.sender, values.sender);
  const onlyTheSetting = canChangeAutoSend && values.sender === 'ChannelManager' && autoSendAsked(values, read) !== undefined;
  const propertyName = useSenderPropertyName(read.propertyId, true);
  // «Le invia lo stesso servizio» only where the table says the channel manager sends the ISTAT of the region: otherwise the notice of the first step is what to read.
  const istatClaim = useIstatClaim(read.propertyId);

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
    { id: 'istat', label: t('compliance.sender.summary.istat'), value: t(istatClaim === 'seeNotice' ? 'compliance.sender.summary.istatSeeNotice' : 'compliance.sender.summary.istatFollows') },
    { id: 'delegation', label: t('compliance.sender.summary.delegation.label'), value: delegation, stepId: automatic ? SENDER_STEP.choice : undefined },
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="sender-summary-step">
      <WizardSummary items={items} />

      {values.sender === 'ChannelManager' ? <AutoSendSetting read={read} canChange={canChangeAutoSend} busy={busy} /> : null}

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
            <Label htmlFor="sender-switch-confirmed" className="flex min-h-11 flex-1 cursor-pointer items-center break-words text-sm font-medium leading-snug">
              {t('compliance.sender.summary.switch.confirm')}
            </Label>
          </div>
        </section>
      ) : (
        <p className="break-words text-sm text-foreground/70" data-testid="sender-switch-none">
          {onlyTheSetting ? t('compliance.sender.autoSend.onlySetting') : t('compliance.sender.summary.switch.same')}
        </p>
      )}
    </div>
  );
}
