import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/shared/form-field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SetIstatCredentialsRequest } from '@/types/onboarding.types';
import { ISTAT_CREDENTIAL_FIELDS, type IstatCredentialsErrors, type IstatCredentialsField } from './istat-credentials-form';

interface IstatCredentialsFieldsProps {
  values: SetIstatCredentialsRequest;
  errors: IstatCredentialsErrors;
  onChange: (field: IstatCredentialsField, value: string) => void;
  /** A request is on its way: the fields cannot be changed meanwhile. */
  disabled?: boolean;
}

/**
 * The three write-only fields of the regional ISTAT credentials: user name, password and the code of the structure (E20/F03/US02/T01). They are fields and no form, so the card of the
 * property (its own form) and the step of the sender wizard (inside the wizard's form) share them, as they share those of the police credentials. Nothing here keeps a value: the caller
 * holds it, sends it once and empties it.
 */
export function IstatCredentialsFields({ values, errors, onChange, disabled = false }: IstatCredentialsFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      {ISTAT_CREDENTIAL_FIELDS.map(({ field, type }) => {
        const id = `istat-${field}`;
        const hint = field === 'structureCode' ? `${id}-hint` : undefined;
        return (
          <div key={field} className="space-y-1">
            <Label htmlFor={id}>{t(`istatCredentials.fields.${field}`)}</Label>
            <Input
              id={id}
              type={type}
              autoComplete="off"
              spellCheck={false}
              value={values[field]}
              disabled={disabled}
              onChange={(event) => onChange(field, event.target.value)}
              aria-invalid={!!errors[field]}
              aria-describedby={[hint, errors[field] ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined}
              data-testid={id}
            />
            {hint ? (
              <p id={hint} className="text-xs text-muted-foreground">
                {t('istatCredentials.hints.structureCode')}
              </p>
            ) : null}
            <FormFieldError id={`${id}-error`} message={errors[field]} />
          </div>
        );
      })}
    </>
  );
}
