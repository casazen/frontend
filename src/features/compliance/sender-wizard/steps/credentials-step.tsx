import { useId, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IstatCredentialsFields } from '@/features/compliance/components/istat-credentials-fields';
import type { IstatCredentialsErrors, IstatCredentialsField } from '@/features/compliance/components/istat-credentials-form';
import { QuesturaCredentialsFields } from '@/features/properties/components/questura-credentials-fields';
import type { QuesturaCredentialsErrors, QuesturaCredentialsField } from '@/features/properties/components/questura-credentials-form';
import type { PropertySender } from '@/types';
import type { SetIstatCredentialsRequest } from '@/types/onboarding.types';
import type { SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';

/** What the step needs to show the regional ISTAT credentials: they are the same kind of thing as the police ones, and are held by the wizard in the same way. */
export interface IstatCredentialsStepProps {
  /** Whether the property has them: `null` while that is read, or when the read failed (the step then says nothing about it). */
  configured: boolean | null;
  /** What was typed: it lives in the wizard, like the police credentials, so that the main button of the wizard can save it and a change of step does not lose it. */
  values: SetIstatCredentialsRequest;
  errors: IstatCredentialsErrors;
  onChange: (field: IstatCredentialsField, value: string) => void;
  /** Sends the typed ISTAT credentials once (`PUT /properties/{id}/istat-credentials`): the button of the block and the Enter key. */
  onSave: () => void;
}

interface CredentialsStepProps {
  read: PropertySender;
  /** What was typed: it lives in the wizard (never in a value of its form, so in no draft), so that the main button of the wizard can save it and a change of step does not lose it. */
  values: SetQuesturaCredentialsRequest;
  errors: QuesturaCredentialsErrors;
  onChange: (field: QuesturaCredentialsField, value: string) => void;
  /** Sends the typed credentials once (`PUT /properties/{id}/questura-credentials`): the button of the step and the Enter key. */
  onSave: () => void;
  /** A request of the wizard is in flight (this one or another): nothing here can be pressed again meanwhile. */
  busy: boolean;
  /** The regional ISTAT credentials, under the police ones: only while the activation of the channel manager is on (the flag `octorateOnboarding`). */
  istat?: IstatCredentialsStepProps;
}

/**
 * Step «Credenziali» (optional): the Alloggiati Web credentials of the property, which CasaZen keeps (encrypted, never shown again) to download the receipts of the communications, and,
 * while the activation of the channel manager is on, the regional ISTAT credentials (E20/F03/US02/T01), which CasaZen support opens only on a request of the host to link the ISTAT in the panel.
 * They are the write-only forms of the property page: the fields are the same ones (`QuesturaCredentialsFields`, `IstatCredentialsFields`). What is typed is held by the wizard in its state only:
 * it is in no value of the form, so in no draft (the browser's or the server's), the address or the cache of the requests, and it leaves with the save. The step says so, because leaving it with the
 * fields filled and unsaved loses what was typed: the main button of the wizard saves them first, Enter in a field saves the block it is in (it does not go on to the next step: the fields are in the form of the
 * wizard, whose Enter would submit it), and «Salva ed esci» says that they were not kept. The channel manager sends without them, so the step can be skipped.
 */
export function CredentialsStep({ read, values, errors, onChange, onSave, busy, istat }: CredentialsStepProps) {
  const { t } = useTranslation();
  const istatTitleId = useId();
  const forCasaZen = read.sender === 'CasaZen';

  const saveOnEnter = (save: () => void) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement)) return;
    // As in the card of the property, Enter saves the credentials; it never submits the form of the wizard, which would go on to the next step with them left behind.
    event.preventDefault();
    if (!busy) save();
  };

  return (
    <div className="flex flex-col gap-4" data-testid="sender-credentials-step">
      <Alert variant="info">{t(forCasaZen ? 'compliance.sender.credentials.whyCasaZen' : 'compliance.sender.credentials.whyChannelManager')}</Alert>

      <p className="flex items-center gap-2 text-sm" data-testid="sender-credentials-status" data-configured={read.questuraCredentialsConfigured}>
        {read.questuraCredentialsConfigured ? (
          <>
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />
            {t('compliance.sender.credentials.saved')}
          </>
        ) : (
          <>
            <KeyRound aria-hidden="true" className="size-4 shrink-0" />
            {t('compliance.sender.credentials.notSaved')}
          </>
        )}
      </p>

      <div className="max-w-md space-y-3" data-testid="sender-credentials-fields" onKeyDown={saveOnEnter(onSave)}>
        <QuesturaCredentialsFields values={values} errors={errors} onChange={onChange} />
        <p className="text-xs text-muted-foreground">{t('questuraCredentials.writeOnlyHint')}</p>
        <p className="text-xs text-muted-foreground" data-testid="sender-credentials-draft-note">
          {t('compliance.sender.credentials.notInDraft')}
        </p>
        <Button type="button" variant="outline" disabled={busy} onClick={onSave} data-testid="sender-credentials-save">
          {read.questuraCredentialsConfigured ? t('questuraCredentials.replace') : t('questuraCredentials.save')}
        </Button>
      </div>

      {istat ? (
        <section aria-labelledby={istatTitleId} className="flex flex-col gap-4 border-t pt-4" data-testid="sender-istat-credentials">
          <div className="space-y-1">
            <h3 id={istatTitleId} className="text-base font-semibold">
              {t('compliance.sender.credentials.istat.title')}
            </h3>
            <p className="text-sm text-foreground/70">{t('compliance.sender.credentials.istat.why')}</p>
          </div>

          {istat.configured !== null ? (
            <p className="flex items-center gap-2 text-sm" data-testid="sender-istat-status" data-configured={istat.configured}>
              {istat.configured ? (
                <>
                  <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />
                  {t('compliance.sender.credentials.istat.saved')}
                </>
              ) : (
                <>
                  <KeyRound aria-hidden="true" className="size-4 shrink-0" />
                  {t('compliance.sender.credentials.istat.notSaved')}
                </>
              )}
            </p>
          ) : null}

          <div className="max-w-md space-y-3" data-testid="sender-istat-fields" onKeyDown={saveOnEnter(istat.onSave)}>
            <IstatCredentialsFields values={istat.values} errors={istat.errors} onChange={istat.onChange} disabled={busy} />
            <p className="text-xs text-muted-foreground">{t('istatCredentials.writeOnlyHint')}</p>
            <Button type="button" variant="outline" disabled={busy} onClick={istat.onSave} data-testid="sender-istat-save">
              {istat.configured ? t('istatCredentials.replace') : t('istatCredentials.save')}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
