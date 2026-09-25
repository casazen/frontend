import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { formatDateTime } from '@/lib/utils';
import {
  useQuesturaCredentialsStatus,
  useRemoveQuesturaCredentials,
  useSetQuesturaCredentials,
} from '@/queries/use-questura-credentials';
import {
  QUESTURA_CREDENTIALS_MAX_LENGTH,
  type SetQuesturaCredentialsRequest,
} from '@/types/questura-credentials.types';

type Field = keyof SetQuesturaCredentialsRequest;

const FIELDS: { field: Field; type: 'text' | 'password'; autoComplete: string }[] = [
  { field: 'username', type: 'text', autoComplete: 'off' },
  { field: 'password', type: 'password', autoComplete: 'new-password' },
  { field: 'wsKey', type: 'password', autoComplete: 'off' },
];

const EMPTY: SetQuesturaCredentialsRequest = { username: '', password: '', wsKey: '' };

/** Client checks mirroring the API (required, maximum length); the API validates again. */
function validate(values: SetQuesturaCredentialsRequest): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const { field } of FIELDS) {
    if (!values[field].trim()) errors[field] = `questuraCredentials.errors.${field}Required`;
    else if (values[field].length > QUESTURA_CREDENTIALS_MAX_LENGTH[field])
      errors[field] = `questuraCredentials.errors.${field}TooLong`;
  }
  return errors;
}

interface QuesturaCredentialsCardProps {
  propertyId: string;
  /** The caller may set, replace or remove them (owner of the property or org admin; the API checks again). */
  canEdit: boolean;
}

/**
 * Alloggiati Web (Questura) credentials of a property (CO-14): write-only. The host enters username, password and WSKey
 * to set or replace them; afterwards only "configured on <date>" is shown, never a value (the API never returns them).
 */
export function QuesturaCredentialsCard({ propertyId, canEdit }: QuesturaCredentialsCardProps) {
  const { t } = useTranslation();
  const status = useQuesturaCredentialsStatus(propertyId);
  const save = useSetQuesturaCredentials(propertyId);
  const remove = useRemoveQuesturaCredentials(propertyId);
  const [values, setValues] = useState<SetQuesturaCredentialsRequest>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [confirmRemove, setConfirmRemove] = useState(false);

  const configured = status.data?.configured === true;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(values, {
      // Write-only: the values leave the page as soon as the API has them.
      onSuccess: () => setValues(EMPTY),
    });
  };

  const handleRemove = () => {
    remove.mutate(undefined, { onSettled: () => setConfirmRemove(false) });
  };

  return (
    <Card data-testid="questura-credentials-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t('questuraCredentials.title')}
        </CardTitle>
        <CardDescription>{t('questuraCredentials.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="questura-credentials-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('questuraCredentials.loading')}
          </p>
        ) : status.isError || !status.data ? (
          <div className="space-y-2" data-testid="questura-credentials-error">
            <p className="text-sm text-destructive">{t('questuraCredentials.loadFailed')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void status.refetch()}>
              {t('questuraCredentials.retry')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2" data-testid="questura-credentials-status">
            {configured && status.data.configuredAt ? (
              <Badge variant="success">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                {t('questuraCredentials.configuredOn', { date: formatDateTime(status.data.configuredAt) })}
              </Badge>
            ) : (
              <Badge variant="secondary">{t('questuraCredentials.notConfigured')}</Badge>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t('questuraCredentials.writeOnlyHint')}</p>

        {canEdit && status.data && (
          <form className="space-y-3" onSubmit={handleSubmit} noValidate data-testid="questura-credentials-form">
            {FIELDS.map(({ field, type, autoComplete }) => {
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
                    onChange={(e) => {
                      const next = e.target.value;
                      setValues((current) => ({ ...current, [field]: next }));
                      setErrors((current) => ({ ...current, [field]: undefined }));
                    }}
                    aria-invalid={!!errors[field]}
                    aria-describedby={errors[field] ? `${id}-error` : undefined}
                  />
                  <FormFieldError id={`${id}-error`} message={errors[field]} />
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="submit" disabled={save.isPending} data-testid="questura-credentials-save">
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {configured ? t('questuraCredentials.replace') : t('questuraCredentials.save')}
              </Button>
              {configured &&
                (confirmRemove ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleRemove}
                      disabled={remove.isPending}
                      data-testid="questura-credentials-remove-confirm"
                    >
                      {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('questuraCredentials.removeConfirm')}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmRemove(false)}>
                      {t('questuraCredentials.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmRemove(true)}
                    data-testid="questura-credentials-remove"
                  >
                    {t('questuraCredentials.remove')}
                  </Button>
                ))}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
