import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, EyeOff } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNow } from '@/hooks/use-now';
import { getProblemMessage } from '@/lib/api-errors';
import { isValidRevealReason, revealVisibleMs } from '@/lib/support-vault';
import { useRevealAssistSecret } from '@/queries/use-admin-onboarding-assist';
import { SUPPORT_VAULT_REASON_LENGTH, type SupportVaultCredentialKind, type SupportVaultReveal } from '@/types/onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** What an opening put on screen: the values and the instant they go (on the clock of the browser, from the moment they arrived). */
interface Opened {
  values: SupportVaultReveal;
  endsAt: number;
}

interface RevealedValuesProps {
  values: SupportVaultReveal;
  endsAt: number;
  /** The minute is over (or the person hid them): the caller drops the values. */
  onEnd: () => void;
}

/**
 * The values of an opening, for as long as they are meant to stay: each one with a button that copies it, and the seconds that are left. They are not in an input and they
 * are not announced by the countdown (it is `aria-live="off"`: a tick a second would read out for a minute). When the minute is over (`endsAt`, a timer and a check when the tab
 * comes back to the front, since a hidden tab may run its timers late) the caller drops them.
 */
function RevealedValues({ values, endsAt, onEnd }: RevealedValuesProps) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    const check = () => {
      if (Date.now() >= endsAt) onEnd();
    };
    const timer = setTimeout(check, Math.max(0, endsAt - Date.now()));
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [endsAt, onEnd]);

  const lines = [
    { key: 'username', value: values.username },
    { key: 'password', value: values.password },
    ...(values.extraCode ? [{ key: 'extraCode', value: values.extraCode }] : []),
  ];

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('onboardingPlan.assist.copied'));
    } catch {
      // No clipboard (an insecure page, a refused permission): the value is still on screen for the minute it has.
      toast.error(t('onboardingPlan.assist.copyError'));
    }
  }

  return (
    <div className="min-w-0 space-y-3" data-testid="assist-reveal-values">
      <Alert variant="warning" title={t('onboardingPlan.assist.reveal.visible.title')}>
        <span aria-live="off" data-testid="assist-reveal-remaining">
          {t('onboardingPlan.assist.reveal.visible.remaining', { seconds })}
        </span>{' '}
        {t('onboardingPlan.assist.reveal.visible.hint')}
      </Alert>
      <dl className="space-y-2">
        {lines.map(({ key, value }) => {
          const label = t(`onboardingPlan.assist.reveal.fields.${key}`);
          return (
            <div key={key} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border bg-card p-2">
              <div className="min-w-0">
                <dt className="text-xs text-foreground/70">{label}</dt>
                <dd className="break-all font-mono text-sm" data-testid={`assist-reveal-value-${key}`}>
                  {value}
                </dd>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-11"
                onClick={() => void copy(value)}
                aria-label={t('onboardingPlan.assist.copyLabel', { what: label })}
                iconRight={<Copy />}
                data-testid={`assist-reveal-copy-${key}`}
              >
                {t('onboardingPlan.assist.copy')}
              </Button>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

interface RevealSecretDialogProps {
  /** The request the credential is opened for: the server opens it only for an open request, and only of the org and the property of that request. */
  requestId: string;
  kind: SupportVaultCredentialKind;
  /** What the credential is for, in words (the structure, or the whole organization): said before the reason is asked. */
  subject: string;
  onClose: () => void;
}

/**
 * The controlled opening of a credential of the support vault (E20/F03/US02/T01, decision O5): the reason is asked first (10 to 300 characters: it stays in the audit of the
 * opening and the host never reads it), then the values are shown for a minute with a button that copies each, and then they are hidden. Nothing of them stays in the browser:
 * they are in the state of this dialog only (the call hands them over and holds nothing, `useRevealAssistSecret`), and the state is emptied when the minute is over, with «Nascondi
 * ora», when the dialog closes and when it goes away. To see them again a new opening is made, with a new reason (the server counts five an hour for each request).
 *
 * A refusal is said under the reason, in words (409 the request is not open, 422 the reason or the credential, 404 there is no such credential, 429 the openings of the hour
 * are over). The dialog cannot be closed, nor the button pressed twice, while the call is on its way.
 */
export function RevealSecretDialog({ requestId, kind, subject, onClose }: RevealSecretDialogProps) {
  const { t } = useTranslation();
  const ids = useId();
  const reveal = useRevealAssistSecret();
  const [reason, setReason] = useState('');
  const [reasonInvalid, setReasonInvalid] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pending = reveal.isPending;
  const what = t(`onboardingPlan.assist.reveal.kinds.${kind}`);

  const hide = useCallback(() => {
    setOpened(null);
    setHidden(true);
  }, []);

  async function open(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!isValidRevealReason(reason)) {
      setReasonInvalid(true);
      return;
    }
    setReasonInvalid(false);
    setError(null);
    setHidden(false);
    try {
      await reveal.mutateAsync({
        id: requestId,
        kind,
        reason: reason.trim(),
        onOpened: (values) => setOpened({ values, endsAt: Date.now() + revealVisibleMs(values) }),
      });
      // The reason is not kept either: a new opening asks a new one.
      setReason('');
    } catch (failure) {
      setError(failure);
    } finally {
      reveal.reset();
    }
  }

  function close() {
    setOpened(null);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && close()}>
      <DialogContent data-testid="assist-reveal-dialog">
        <DialogHeader>
          <DialogTitle>{t('onboardingPlan.assist.reveal.title', { what })}</DialogTitle>
          <DialogDescription>{t('onboardingPlan.assist.reveal.description', { subject })}</DialogDescription>
        </DialogHeader>

        {opened ? (
          <>
            <RevealedValues values={opened.values} endsAt={opened.endsAt} onEnd={hide} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className={TOUCH_TARGET} onClick={hide} iconRight={<EyeOff />} data-testid="assist-reveal-hide">
                {t('onboardingPlan.assist.reveal.visible.hideNow')}
              </Button>
              <Button type="button" className={TOUCH_TARGET} onClick={close} data-testid="assist-reveal-close">
                {t('onboardingPlan.assist.reveal.visible.close')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form className="space-y-3" noValidate onSubmit={(event) => void open(event)} data-testid="assist-reveal-form">
            {hidden ? (
              <Alert variant="info" title={t('onboardingPlan.assist.reveal.hidden.title')} data-testid="assist-reveal-hidden">
                {t('onboardingPlan.assist.reveal.hidden.text')}
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`${ids}-reason`}>{t('onboardingPlan.assist.reveal.reason.label')}</Label>
              <Textarea
                id={`${ids}-reason`}
                value={reason}
                maxLength={SUPPORT_VAULT_REASON_LENGTH.max}
                disabled={pending}
                aria-invalid={reasonInvalid || undefined}
                aria-describedby={`${ids}-hint${reasonInvalid ? ` ${ids}-invalid` : ''}`}
                onChange={(event) => setReason(event.target.value)}
                data-testid="assist-reveal-reason"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
                <p id={`${ids}-hint`}>{t('onboardingPlan.assist.reveal.reason.hint')}</p>
                <p aria-live="off" data-testid="assist-reveal-reason-counter">
                  {t('onboardingPlan.assist.reveal.reason.counter', { count: reason.length, max: SUPPORT_VAULT_REASON_LENGTH.max })}
                </p>
              </div>
              {reasonInvalid ? (
                <p id={`${ids}-invalid`} role="alert" className="text-sm text-danger-foreground" data-testid="assist-reveal-reason-error">
                  {t('onboardingPlan.assist.reveal.reason.invalid')}
                </p>
              ) : null}
              {error !== null ? (
                <p role="alert" className="text-sm text-danger-foreground" data-testid="assist-reveal-error">
                  {getProblemMessage(error, t) ?? t('onboardingPlan.assist.reveal.error')}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={pending} onClick={close} data-testid="assist-reveal-cancel">
                {t('onboardingPlan.assist.reveal.cancel')}
              </Button>
              <Button type="submit" className={TOUCH_TARGET} loading={pending} data-testid="assist-reveal-confirm">
                {t('onboardingPlan.assist.reveal.confirm')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
