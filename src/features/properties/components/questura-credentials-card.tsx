import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import {
  useQuesturaCredentialsStatus,
  useRemoveQuesturaCredentials,
  useSetQuesturaCredentials,
} from '@/queries/use-questura-credentials';
import type { SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';
import { QuesturaCredentialsFields } from './questura-credentials-fields';
import { EMPTY_QUESTURA_CREDENTIALS, validateQuesturaCredentials, type QuesturaCredentialsErrors } from './questura-credentials-form';

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
  const titleId = useId();
  const status = useQuesturaCredentialsStatus(propertyId);
  const save = useSetQuesturaCredentials(propertyId);
  const remove = useRemoveQuesturaCredentials(propertyId);
  const [values, setValues] = useState<SetQuesturaCredentialsRequest>(EMPTY_QUESTURA_CREDENTIALS);
  const [errors, setErrors] = useState<QuesturaCredentialsErrors>({});
  const [confirmRemove, setConfirmRemove] = useState(false);

  const configured = status.data?.configured === true;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateQuesturaCredentials(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(values, {
      // Write-only: the values leave the page as soon as the API has them.
      onSuccess: () => setValues(EMPTY_QUESTURA_CREDENTIALS),
    });
  };

  const handleRemove = () => {
    remove.mutate(undefined, { onSettled: () => setConfirmRemove(false) });
  };

  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-3" data-testid="questura-credentials-card">
      <div className="space-y-1">
        <h2 id={titleId} className="flex min-w-0 items-center gap-2 break-words text-lg font-semibold">
          <KeyRound aria-hidden="true" className="size-5 shrink-0" />
          {t('questuraCredentials.title')}
        </h2>
        <p className="text-sm text-foreground/70">{t('questuraCredentials.description')}</p>
      </div>
      <div className="space-y-4">
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
          <form className="max-w-md space-y-3" onSubmit={handleSubmit} noValidate data-testid="questura-credentials-form">
            <QuesturaCredentialsFields
              values={values}
              errors={errors}
              onChange={(field, value) => {
                setValues((current) => ({ ...current, [field]: value }));
                setErrors((current) => ({ ...current, [field]: undefined }));
              }}
            />
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
      </div>
    </section>
  );
}
