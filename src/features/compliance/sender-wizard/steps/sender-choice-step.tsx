import { FileText, Network, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Label } from '@/components/ui/label';
import { IstatCoverageNotice } from '@/features/compliance/components/istat-coverage-notice';
import { useIstatClaim } from '@/features/compliance/lib/use-istat-claim';
import type { PropertySender } from '@/types';
import { SenderStateBadge } from '../sender-state-badge';
import { autoSendInForce, delegationTextKey, isAutomaticSender, outcomeOfSender, senderOptions, type SenderWizardValues } from '../sender-wizard-model';

interface SenderChoiceStepProps {
  read: PropertySender;
}

function DelegationConsent({ read }: SenderChoiceStepProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<SenderWizardValues>();
  const consentVersion = useWatch({ control, name: 'delegationConsentVersion' });
  const textKey = delegationTextKey(read.delegationTextVersion);

  return (
    <section className="min-w-0 space-y-3 rounded-lg bg-muted p-4" aria-labelledby="sender-delegation-title" data-testid="sender-delegation">
      <h3 id="sender-delegation-title" className="text-base font-semibold">
        {t('compliance.sender.delegation.title')}
      </h3>
      <p className="break-words text-sm">{t('compliance.sender.delegation.intro')}</p>
      {textKey ? (
        <>
          <div
            tabIndex={0}
            role="region"
            aria-label={t('compliance.sender.delegation.textLabel')}
            className="max-h-48 overflow-auto whitespace-pre-line break-words rounded-md bg-background p-3 text-sm ring-1 ring-inset ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="sender-delegation-text"
          >
            {t(textKey)}
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="sender-delegation-consent"
              checked={consentVersion === read.delegationTextVersion}
              onCheckedChange={(checked) =>
                setValue('delegationConsentVersion', checked === true ? read.delegationTextVersion : '', { shouldDirty: true, shouldTouch: true })
              }
              data-testid="sender-delegation-consent"
            />
            <Label htmlFor="sender-delegation-consent" className="flex min-h-11 flex-1 cursor-pointer items-center break-words text-sm font-medium leading-snug">
              {t('compliance.sender.delegation.consent')}
            </Label>
          </div>
        </>
      ) : (
        <Alert variant="warning" data-testid="sender-delegation-unknown">
          {t('compliance.sender.delegation.unknownVersion')}
        </Alert>
      )}
    </section>
  );
}

/**
 * Step «Chi invia»: who sends the guest data to the police (and ISTAT, which follows). Three ways in plain words: the channel manager (only where the property has one that
 * can send), CasaZen (shown as not available while the server says so) and the host's own file. The delegation of the transmission is asked here, for an automatic sender,
 * until the organization has accepted the text in force.
 */
export function SenderChoiceStep({ read }: SenderChoiceStepProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<SenderWizardValues>();
  const chosen = useWatch({ control, name: 'sender' });
  const options = senderOptions(read);
  const automatic = isAutomaticSender(chosen);
  const istatClaim = useIstatClaim(read.propertyId);
  const directActive = read.sender === 'CasaZen' && read.state !== 'Inactive';

  return (
    <div className="flex flex-col gap-6" data-testid="sender-choice-step">
      {read.source === 'OrganizationDefault' ? <Alert variant="info">{t('orgComplianceSender.inherited')} <Link className="underline underline-offset-4" to="/app/short-rent/onboarding">{t('orgComplianceSender.editAccount')}</Link></Alert> : null}
      {/* Whether the channel manager sends the ISTAT of the region of the property, said at once, before anything is asked (CHK-05 point 3). Behind the flag of the activation: with it off nothing is drawn. */}
      <IstatCoverageNotice propertyId={read.propertyId} inWizard senderOpen />

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm" data-testid="sender-current">
        <span className="text-foreground/70">
          {t('compliance.sender.choice.now', { sender: t(`compliance.sender.choice.options.${read.sender}.title`) })}
        </span>
        <SenderStateBadge outcome={outcomeOfSender(read)} testId="sender-current-state" />
      </div>
      {read.sender === 'ChannelManager' && !autoSendInForce(read) ? (
        <p className="break-words text-sm text-foreground/70" data-testid="sender-auto-send-off">
          {t('compliance.sender.choice.autoSendOff')}
        </p>
      ) : null}

      <ChoiceGroup legend={t('compliance.sender.choice.legend')} minCardWidth={15}>
        {options.map(({ sender, available }) => (
          <ChoiceCard
            key={sender}
            icon={sender === 'ChannelManager' ? Network : sender === 'CasaZen' ? Send : FileText}
            name="sender"
            value={sender}
            checked={chosen === sender}
            disabled={!available}
            onChange={() => setValue('sender', sender, { shouldDirty: true, shouldTouch: true })}
            title={t(`compliance.sender.choice.options.${sender}.title`)}
            description={
              available
                ? t(`compliance.sender.choice.options.${sender}.description`)
                : directActive
                  ? t('compliance.sender.choice.directActive')
                  : sender === 'CasaZen'
                    ? t('compliance.sender.choice.options.CasaZen.unavailable')
                    : t('compliance.sender.choice.notAvailable')
            }
            data-testid={`sender-option-${sender}`}
          />
        ))}
      </ChoiceGroup>

      {automatic && !read.delegationAccepted ? <DelegationConsent read={read} /> : null}
      {automatic && read.delegationAccepted ? (
        <p className="break-words text-sm text-foreground/70" data-testid="sender-delegation-accepted">
          {t('compliance.sender.delegation.accepted')}
        </p>
      ) : null}

      {/* The same sender «si occupa anche dell'ISTAT» only where the table says the channel manager sends it: otherwise the notice above is what to read (a state that is not checked is never said). */}
      <p className="break-words text-sm text-foreground/70" data-testid="sender-istat-note">
        {istatClaim === 'seeNotice' ? t('compliance.sender.choice.istatSeeNotice') : t('compliance.sender.choice.istat')}
      </p>
    </div>
  );
}
