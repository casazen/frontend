import { useRef, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { useActivationPlans, useUpdateActivationSettings } from '@/queries/use-marketplace';
import type { MarketplaceConnectionKind, MarketplaceIntegrationProperty, UpdateMarketplaceSettingsRequest } from '@/types';
import { CREDENTIAL_MAX_LENGTH, HOTEL_ID_MAX_LENGTH, requirementsOf } from '../activation/activation-wizard-model';
import { badgeStatusOf } from '../lib/active-model';
import { changeErrorText, leftUnchanged } from '../lib/change-errors';

/** The activation whose settings are changed: a channel or a tool, for a property. */
export interface SettingsTarget {
  activationId: string;
  kind: MarketplaceConnectionKind;
  code: string;
  name: string;
  property: MarketplaceIntegrationProperty | null;
}

interface IntegrationSettingsDialogProps {
  target: SettingsTarget;
  /** The change of the card: it is the card's, so that every button of the card is shut while it is on its way. */
  update: ReturnType<typeof useUpdateActivationSettings>;
  /** Closes the dialog (the card stops mounting it): what was typed is forgotten with it. */
  onClose: () => void;
}

/**
 * The settings of a channel or a tool (E09/F03/US02/T02, MKT-05, NF-58, AC-NF58-1): the identifier of the property on the channel and, when the portal asks for them, the username and
 * the password. It asks the plan of the portal what it wants (the same read as the activation wizard's) and shows only that. What is typed lives in this component and nowhere else:
 * never a draft, never the storage of the browser, never the address, and the mutation that sends it is not kept (`gcTime: 0`) nor does it keep the request of a refusal; it is sent once, in one
 * call, only the fields that were filled, and forgotten when the dialog closes. The call is made once, the buttons are shut and the dialog stays while the answer is on its way, and a refusal
 * is said (and whether the settings were left as they were) with what was typed still there to correct.
 */
export function IntegrationSettingsDialog({ target, update, onClose }: IntegrationSettingsDialogProps) {
  const { t } = useTranslation();
  const plans = useActivationPlans(target.kind, target.code, target.property ? [target.property.id] : []);
  const plan = plans[0];
  const requirements = plan?.data && !plan.isError ? requirementsOf(plan.data.requirements) : null;
  const [hotelId, setHotelId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // The call is made once: a second press before the first answer comes (or Escape while it is on its way) does nothing.
  const inFlight = useRef(false);
  const busy = update.isPending;

  // Only what the portal asks for and the person filled: a field left empty is not sent, and nothing is «everything».
  const settings: UpdateMarketplaceSettingsRequest = {
    ...(requirements?.hotelId && hotelId.trim() !== '' ? { hotelId: hotelId.trim() } : {}),
    ...(requirements?.credentials && username.trim() !== '' ? { username: username.trim() } : {}),
    ...(requirements?.credentials && password !== '' ? { password } : {}),
  };
  const asksForAnything = requirements !== null && (requirements.hotelId || requirements.credentials);
  const filled = Object.keys(settings).length > 0;

  const close = () => {
    if (inFlight.current) return;
    update.reset();
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The dialog is drawn outside the page but sits inside it for React: its submit must not reach a form around it.
    event.stopPropagation();
    if (!asksForAnything || !filled || inFlight.current) return;
    inFlight.current = true;
    try {
      const change = await update.mutateAsync({ id: target.activationId, settings });
      // The connection is as the channel manager says after the change: only Active is «saved and working».
      if (change.status === 'Active') toast.success(t('marketplace.change.settings.saved'));
      else toast.warning(t('marketplace.change.settings.savedNotActive', { status: t(`marketplace.status.${badgeStatusOf(change.status)}`) }));
      update.reset();
      onClose();
    } catch {
      // The refusal is on the screen (`update.error`), with what was typed still there to correct.
    } finally {
      inFlight.current = false;
    }
  };

  // The words of a refusal, and whether the settings were left as they were (said outside the markup: a key given to a function is not text to translate).
  const failure = update.isError ? changeErrorText(update.error, t, 'marketplace.change.settings.failed') : null;

  const description = target.property
    ? t('marketplace.change.settings.description', { name: target.name, property: target.property.name })
    : t('marketplace.change.settings.descriptionOrganization', { name: target.name });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} className="grid gap-4" noValidate data-testid="settings-form">
          <DialogHeader>
            <DialogTitle>{t('marketplace.change.settings.title', { name: target.name })}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {plan?.isError ? (
            getHttpStatus(plan.error) === 404 ? (
              <Alert variant="warning" data-testid="settings-plan-not-found">
                {t('marketplace.change.settings.planNotFound')}
              </Alert>
            ) : (
              <Alert
                variant="danger"
                data-testid="settings-plan-error"
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void plan.refetch()}>
                    {t('marketplace.change.settings.retry')}
                  </Button>
                }
              >
                {t('marketplace.change.settings.planError')}
              </Alert>
            )
          ) : requirements === null ? (
            <SkeletonLine lines={3} label={t('marketplace.change.settings.planLoading')} />
          ) : !asksForAnything ? (
            <Alert variant="info" data-testid="settings-nothing-to-change">
              {t('marketplace.change.settings.nothingToChange')}
            </Alert>
          ) : (
            <div className="grid gap-4">
              {requirements.hotelId ? (
                <Field label={t('marketplace.change.settings.hotelId')} hint={t('marketplace.change.settings.hotelIdHint')} optional>
                  <Input value={hotelId} onChange={(event) => setHotelId(event.target.value)} maxLength={HOTEL_ID_MAX_LENGTH} autoComplete="off" disabled={busy} data-testid="settings-hotel-id" />
                </Field>
              ) : null}
              {requirements.credentials ? (
                <>
                  <Field label={t('marketplace.change.settings.username')} optional>
                    <Input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={CREDENTIAL_MAX_LENGTH} autoComplete="off" disabled={busy} data-testid="settings-username" />
                  </Field>
                  <Field label={t('marketplace.change.settings.password')} hint={t('marketplace.change.settings.credentialsHint')} optional>
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      maxLength={CREDENTIAL_MAX_LENGTH}
                      autoComplete="new-password"
                      disabled={busy}
                      data-testid="settings-password"
                    />
                  </Field>
                </>
              ) : null}
              {!filled ? <p className="text-sm text-muted-foreground">{t('marketplace.change.settings.nothingGiven')}</p> : null}
            </div>
          )}

          {busy ? (
            <p className="flex items-center gap-2 text-sm font-medium" role="status" data-testid="settings-working">
              <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              {t('marketplace.change.settings.working')}
            </p>
          ) : null}
          {update.isError ? (
            <Alert variant="danger" data-testid="settings-error">
              <p>{failure}</p>
              <p>{leftUnchanged(update.error) ? t('marketplace.change.outcome.unchanged') : t('marketplace.change.outcome.unknown')}</p>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              {t('shared.cancel')}
            </Button>
            <Button type="submit" disabled={busy || !asksForAnything || !filled} data-testid="settings-save">
              {t('marketplace.change.settings.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
