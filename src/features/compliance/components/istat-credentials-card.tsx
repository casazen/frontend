import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AssistRequestButton } from '@/features/onboarding/components/assist-request-button';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { findPanelStep, isPanelStepDone } from '@/lib/onboarding-panel';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { formatDateTime } from '@/lib/utils';
import { useIstatCredentialsStatus, useRemoveIstatCredentials, useSetIstatCredentials } from '@/queries/use-istat-credentials';
import { usePanelSteps } from '@/queries/use-onboarding-panel-step';
import type { SetIstatCredentialsRequest } from '@/types/onboarding.types';
import { IstatCredentialsFields } from './istat-credentials-fields';
import { EMPTY_ISTAT_CREDENTIALS, validateIstatCredentials, type IstatCredentialsErrors } from './istat-credentials-form';

interface IstatAssistProps {
  propertyId: string;
}

/**
 * The «Do it for me» of the ISTAT connection of the property, under the credentials (E20/F03/US02/T01): the host asks CasaZen support to link the regional ISTAT in the panel of its
 * channel manager, with the credentials saved above, and reads where the request stands: «Ci pensa il supporto di CasaZen», then «Verificato» or «Dichiarato dal supporto» (ISTAT
 * can never be read on the panel, so it is the support's word) with «Non funziona». The organization administrator's, and behind the flag, like the button itself: for anyone else
 * nothing is drawn and nothing is asked.
 */
function IstatAssist({ propertyId }: IstatAssistProps) {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const { flags } = useFeatureFlags();
  const available = flags.octorateOnboarding && isOrgBillingAdmin(contexts);
  const steps = usePanelSteps(propertyId, { enabled: available });
  const step = findPanelStep(steps.data, { kind: 'istatConnection', propertyId });

  if (!available) return null;

  return (
    <div className="min-w-0 space-y-2 border-t pt-3" data-testid="istat-credentials-assist">
      <p className="text-sm text-foreground/70">{t('istatCredentials.assist.description')}</p>
      <AssistRequestButton part="compliance" context="panelIstat" propertyId={propertyId} stepDone={isPanelStepDone(step)} />
    </div>
  );
}

interface IstatCredentialsCardProps {
  propertyId: string;
  /** The caller may set, replace or remove them (`property.write`; the API checks again). */
  canEdit: boolean;
}

/**
 * The regional ISTAT credentials of a property (E20/F03/US02/T01): write-only, like the police credentials. The host enters the user name, the password and, when the portal of its
 * region asks for it, the code of the structure; afterwards only «configurate il ...» is shown, never a value (the API never returns them). CasaZen support opens them only on a
 * «Do it for me» request of the host, with a reason, and each opening is in the activity log. Behind the flag `octorateOnboarding` (the caller draws it only while it is on: the endpoint
 * answers 404 while it is off). Under the credentials, the host can ask support to link the ISTAT for it and follows the request.
 */
export function IstatCredentialsCard({ propertyId, canEdit }: IstatCredentialsCardProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const status = useIstatCredentialsStatus(propertyId);
  const save = useSetIstatCredentials(propertyId);
  const remove = useRemoveIstatCredentials(propertyId);
  const [values, setValues] = useState<SetIstatCredentialsRequest>(EMPTY_ISTAT_CREDENTIALS);
  const [errors, setErrors] = useState<IstatCredentialsErrors>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Any request of the card in flight: none of its buttons can be pressed again meanwhile.
  const busy = save.isPending || remove.isPending;

  const configured = status.data?.configured === true;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validateIstatCredentials(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(values, {
      // Write-only: the values leave the page as soon as the API has them, and the mutation drops what it was asked (it holds the password until it is reset).
      onSuccess: () => setValues(EMPTY_ISTAT_CREDENTIALS),
      onSettled: () => save.reset(),
    });
  };

  const handleRemove = () => {
    remove.mutate(undefined, { onSettled: () => setConfirmRemove(false) });
  };

  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-3" data-testid="istat-credentials-card">
      <div className="space-y-1">
        <h2 id={titleId} className="flex min-w-0 items-center gap-2 break-words text-lg font-semibold">
          <KeyRound aria-hidden="true" className="size-5 shrink-0" />
          {t('istatCredentials.title')}
        </h2>
        <p className="text-sm text-foreground/70">{t('istatCredentials.description')}</p>
      </div>
      <div className="space-y-4">
        {status.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="istat-credentials-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('istatCredentials.loading')}
          </p>
        ) : status.isError || !status.data ? (
          <div className="space-y-2" data-testid="istat-credentials-error">
            <p className="text-sm text-destructive">{t('istatCredentials.loadFailed')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void status.refetch()}>
              {t('istatCredentials.retry')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2" data-testid="istat-credentials-status" data-configured={configured}>
            {configured && status.data.configuredAt ? (
              <Badge variant="success">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                {t('istatCredentials.configuredOn', { date: formatDateTime(status.data.configuredAt) })}
              </Badge>
            ) : (
              <Badge variant="secondary">{t('istatCredentials.notConfigured')}</Badge>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t('istatCredentials.writeOnlyHint')}</p>

        {canEdit && status.data && (
          <form className="max-w-md space-y-3" onSubmit={handleSubmit} noValidate data-testid="istat-credentials-form">
            <IstatCredentialsFields
              values={values}
              errors={errors}
              disabled={busy}
              onChange={(field, value) => {
                setValues((current) => ({ ...current, [field]: value }));
                setErrors((current) => ({ ...current, [field]: undefined }));
              }}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="submit" disabled={busy} data-testid="istat-credentials-save">
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {configured ? t('istatCredentials.replace') : t('istatCredentials.save')}
              </Button>
              {configured &&
                (confirmRemove ? (
                  <>
                    <Button type="button" variant="destructive" onClick={handleRemove} disabled={busy} data-testid="istat-credentials-remove-confirm">
                      {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('istatCredentials.removeConfirm')}
                    </Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(false)}>
                      {t('istatCredentials.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmRemove(true)} data-testid="istat-credentials-remove">
                    {t('istatCredentials.remove')}
                  </Button>
                ))}
            </div>
          </form>
        )}

        <IstatAssist propertyId={propertyId} />
      </div>
    </section>
  );
}
