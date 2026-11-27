import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProblemMessage } from '@/lib/api-errors';
import { useStoreSupportVaultSecret } from '@/queries/use-admin-onboarding-assist';
import { SUPPORT_VAULT_VALUE_MAX_LENGTH } from '@/types/onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

type Field = 'username' | 'password';
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { username: '', password: '' };
const FIELDS: readonly { field: Field; type: 'text' | 'password' }[] = [
  { field: 'username', type: 'text' },
  { field: 'password', type: 'password' },
];

/** The checks of the vault, mirrored (a value is required and has its longest): the server checks again (422 `support_vault_value_invalid`). The messages are i18n keys. */
function validate(values: Values): Errors {
  const errors: Errors = {};
  for (const { field } of FIELDS) {
    if (!values[field].trim()) errors[field] = `onboardingPlan.assist.vault.errors.${field}Required`;
    else if (values[field].length > SUPPORT_VAULT_VALUE_MAX_LENGTH[field]) errors[field] = `onboardingPlan.assist.vault.errors.${field}TooLong`;
  }
  return errors;
}

interface VaultSecretFormProps {
  orgId: string;
  /** The structure the user of the panel is for; `null` for the user of the whole organization. */
  propertyId: string | null;
  /** A credential is in the vault already: the form replaces it. */
  present: boolean;
}

/**
 * The user of the panel of a structure CasaZen created, for the support vault (E20/F03/US02/T01, PO-19): the welcome message that carries it reaches the CasaZen address of
 * the organization only, so support copies it here, encrypted, and deletes the message. Write-only: once saved it is never shown again, and the only way to see it is the
 * controlled opening of a request. The form is closed until it is asked for, so the checklist stays calm; the fields leave the page as soon as the server has the
 * values (and are never in the cache of the queries, `useStoreSupportVaultSecret`), and a refusal keeps them to be corrected.
 */
export function VaultSecretForm({ orgId, propertyId, present }: VaultSecretFormProps) {
  const { t } = useTranslation();
  const ids = useId();
  const store = useStoreSupportVaultSecret();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  // The refusal of the server, kept here and not in the mutation: a mutation that is watched keeps what it was asked (the password) until it is reset.
  const [failure, setFailure] = useState<unknown>(null);

  function close() {
    setOpen(false);
    setValues(EMPTY);
    setErrors({});
    setFailure(null);
    store.reset();
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (store.isPending) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFailure(null);
    store.mutate(
      { orgId, ...(propertyId ? { propertyId } : {}), kind: 'OctoratePanel', username: values.username, password: values.password },
      {
        // Write-only: the values leave the page as soon as the server has them.
        onSuccess: close,
        // A refusal keeps the values in the fields, to be corrected, and says why under them.
        onError: setFailure,
        // Whatever the end, the mutation is reset: it holds nothing of the request, not even after a refusal (the cache of the mutations never has the password).
        onSettled: () => store.reset(),
      },
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className={TOUCH_TARGET} onClick={() => setOpen(true)} iconRight={<KeyRound />} data-testid="assist-vault-open">
        {t(present ? 'onboardingPlan.assist.vault.replace' : 'onboardingPlan.assist.vault.open')}
      </Button>
    );
  }

  return (
    <form className="min-w-0 max-w-md space-y-3 rounded-md border bg-card p-3" noValidate onSubmit={save} data-testid="assist-vault-form">
      <p className="text-sm text-foreground/70">{t('onboardingPlan.assist.vault.description')}</p>
      {FIELDS.map(({ field, type }) => {
        const id = `${ids}-${field}`;
        return (
          <div key={field} className="space-y-1">
            <Label htmlFor={id}>{t(`onboardingPlan.assist.vault.fields.${field}`)}</Label>
            <Input
              id={id}
              type={type}
              autoComplete="off"
              spellCheck={false}
              value={values[field]}
              disabled={store.isPending}
              aria-invalid={!!errors[field]}
              aria-describedby={errors[field] ? `${id}-error` : undefined}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field]: event.target.value }));
                setErrors((current) => ({ ...current, [field]: undefined }));
              }}
              data-testid={`assist-vault-${field}`}
            />
            <FormFieldError id={`${id}-error`} message={errors[field]} />
          </div>
        );
      })}
      {failure !== null ? (
        <p role="alert" className="text-sm text-danger-foreground" data-testid="assist-vault-error">
          {getProblemMessage(failure, t) ?? t('onboardingPlan.assist.vault.error')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className={TOUCH_TARGET} loading={store.isPending} data-testid="assist-vault-save">
          {t('onboardingPlan.assist.vault.save')}
        </Button>
        <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={store.isPending} onClick={close} data-testid="assist-vault-cancel">
          {t('onboardingPlan.assist.vault.cancel')}
        </Button>
      </div>
    </form>
  );
}
