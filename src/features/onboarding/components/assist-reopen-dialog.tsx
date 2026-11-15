import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { ASSIST_NOTE_MAX_LENGTH } from '@/types/onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface AssistReopenDialogProps {
  onClose: () => void;
  /** Sends the note and settles when the server answered: a rejection is the refusal, said under the note. */
  onReopen: (note: string) => Promise<unknown>;
}

/**
 * «Non funziona» (E20/F03/US02/T01): the host says what does not work in a connection support made, and the request goes back to support with that note. The note is required (the
 * server refuses an empty one, 422 `assist_reopen_note_required`), at most 500 characters, and has no e-mail address (the same 422): the refusal is said under the field and the dialog
 * stays open so the note can be fixed. It closes when the server accepted the reopening, and it can neither be closed nor pressed twice while the call is on its way.
 */
export function AssistReopenDialog({ onClose, onReopen }: AssistReopenDialogProps) {
  const { t } = useTranslation();
  const ids = useId();
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function confirm(event: FormEvent) {
    event.preventDefault();
    // The dialog is drawn in a portal, but its events bubble through the React tree: the button that opens it can be inside the form of a wizard (the sender wizard's panel step),
    // and a submit that is not stopped here would submit that form too, and go on to its next step.
    event.stopPropagation();
    if (sending) return;
    const trimmed = note.trim();
    if (trimmed === '') {
      setMissing(true);
      return;
    }
    setMissing(false);
    setError(null);
    setSending(true);
    try {
      await onReopen(trimmed);
      onClose();
    } catch (failure) {
      setError(failure);
      setSending(false);
    }
  }

  const described = [`${ids}-hint`, missing ? `${ids}-missing` : '', error !== null ? `${ids}-error` : ''].filter(Boolean).join(' ');

  return (
    <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent data-testid="assist-reopen-dialog">
        <DialogHeader>
          <DialogTitle>{t('onboardingPlan.panel.assist.notWorking.title')}</DialogTitle>
          <DialogDescription>{t('onboardingPlan.panel.assist.notWorking.description')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={(event) => void confirm(event)}>
          <div className="space-y-2">
            <Label htmlFor={`${ids}-note`}>{t('onboardingPlan.panel.assist.notWorking.label')}</Label>
            <Textarea
              id={`${ids}-note`}
              value={note}
              maxLength={ASSIST_NOTE_MAX_LENGTH}
              disabled={sending}
              aria-invalid={missing || error !== null || undefined}
              aria-describedby={described}
              onChange={(event) => setNote(event.target.value)}
              data-testid="assist-reopen-note"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
              <p id={`${ids}-hint`}>{t('onboardingPlan.panel.assist.notWorking.hint')}</p>
              <p aria-live="off" data-testid="assist-reopen-counter">
                {t('onboardingPlan.panel.assist.notWorking.counter', { count: note.length, max: ASSIST_NOTE_MAX_LENGTH })}
              </p>
            </div>
            {missing ? (
              <p id={`${ids}-missing`} role="alert" className="text-sm text-danger-foreground" data-testid="assist-reopen-missing">
                {t('onboardingPlan.panel.assist.notWorking.required')}
              </p>
            ) : null}
            {error !== null ? (
              <p id={`${ids}-error`} role="alert" className="text-sm text-danger-foreground" data-testid="assist-reopen-error">
                {getProblemMessage(error, t) ?? t('onboardingPlan.panel.assist.notWorking.error')}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={sending} onClick={onClose} data-testid="assist-reopen-cancel">
              {t('onboardingPlan.panel.assist.notWorking.cancel')}
            </Button>
            <Button type="submit" className={TOUCH_TARGET} loading={sending} data-testid="assist-reopen-confirm">
              {t('onboardingPlan.panel.assist.notWorking.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
