import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { QuesturaCredentialsFields } from '@/features/properties/components/questura-credentials-fields';
import {
  EMPTY_QUESTURA_CREDENTIALS,
  validateQuesturaCredentials,
  type QuesturaCredentialsErrors,
} from '@/features/properties/components/questura-credentials-form';
import type { PropertySender } from '@/types';
import type { SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';

interface CredentialsStepProps {
  read: PropertySender;
  /** Sends the credentials once (`PUT /properties/{id}/questura-credentials`); `done` runs when the server has them. */
  onSave: (values: SetQuesturaCredentialsRequest, done: () => void) => void;
  /** A request of the wizard is in flight (this one or another): nothing here can be pressed again meanwhile. */
  busy: boolean;
}

/**
 * Step «Credenziali» (optional): the Alloggiati Web credentials of the property, which CasaZen keeps (encrypted, never shown again) to download the receipts of the communications. It is
 * the write-only form of the property page: the fields are the same ones (`QuesturaCredentialsFields`), and the values live in the state of this step only, so they are in no value of the
 * wizard, never in its draft (the browser's or the server's), the address or the cache of the requests: they leave with the save and the fields are empty again. The channel manager
 * sends without them, so the step can be skipped.
 */
export function CredentialsStep({ read, onSave, busy }: CredentialsStepProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<SetQuesturaCredentialsRequest>(EMPTY_QUESTURA_CREDENTIALS);
  const [errors, setErrors] = useState<QuesturaCredentialsErrors>({});
  const forCasaZen = read.sender === 'CasaZen';

  const save = () => {
    const found = validateQuesturaCredentials(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSave(values, () => setValues(EMPTY_QUESTURA_CREDENTIALS));
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

      <div className="max-w-md space-y-3" data-testid="sender-credentials-fields">
        <QuesturaCredentialsFields
          values={values}
          errors={errors}
          onChange={(field, value) => {
            setValues((current) => ({ ...current, [field]: value }));
            setErrors((current) => ({ ...current, [field]: undefined }));
          }}
        />
        <p className="text-xs text-muted-foreground">{t('questuraCredentials.writeOnlyHint')}</p>
        <Button type="button" variant="outline" disabled={busy} onClick={save} data-testid="sender-credentials-save">
          {read.questuraCredentialsConfigured ? t('questuraCredentials.replace') : t('questuraCredentials.save')}
        </Button>
      </div>
    </div>
  );
}
