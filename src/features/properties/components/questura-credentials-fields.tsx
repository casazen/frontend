import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/shared/form-field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';
import { QUESTURA_CREDENTIAL_FIELDS, type QuesturaCredentialsErrors, type QuesturaCredentialsField } from './questura-credentials-form';

interface QuesturaCredentialsFieldsProps {
  values: SetQuesturaCredentialsRequest;
  errors: QuesturaCredentialsErrors;
  onChange: (field: QuesturaCredentialsField, value: string) => void;
}

/**
 * The three write-only fields of the Alloggiati Web (Questura) credentials: username, password and WSKey (CO-14). They are fields and no form, so the card of the property
 * (its own form) and the step of the sender wizard (inside the wizard's form) share them. Nothing here keeps a value: the caller holds it, sends it once and empties it.
 */
export function QuesturaCredentialsFields({ values, errors, onChange }: QuesturaCredentialsFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      {QUESTURA_CREDENTIAL_FIELDS.map(({ field, type, autoComplete }) => {
        const id = `questura-${field}`;
        return (
          <div key={field} className="space-y-1">
            <Label htmlFor={id}>{t(`questuraCredentials.fields.${field}`)}</Label>
            <Input
              id={id}
              type={type}
              autoComplete={autoComplete}
              spellCheck={false}
              value={values[field]}
              onChange={(event) => onChange(field, event.target.value)}
              aria-invalid={!!errors[field]}
              aria-describedby={errors[field] ? `${id}-error` : undefined}
            />
            <FormFieldError id={`${id}-error`} message={errors[field]} />
          </div>
        );
      })}
    </>
  );
}
