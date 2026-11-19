import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { GUEST_MESSAGE_MAX_LENGTH, type ScheduledMessage } from '@/types';
import { TEMPLATE_VARIABLES, withVariablesInPlaceOfStandIns } from '../lib/scheduled-messages';
import { ScheduledMessageText } from './scheduled-message-text';

interface ScheduledMessageEditDialogProps {
  /** The message to edit; the dialog reads the text as it is now. */
  message: ScheduledMessage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Saves the text of THIS message, or goes back to the text of the routine with `null`. The request belongs to the card, not to the dialog: the host may close the dialog while it goes on, and
   * its answer must still be dealt with (the failure on the card, the list read again). It resolves when the answer has been dealt with; a refusal is handed back as `problem`.
   */
  onSave: (text: string | null) => void | Promise<void>;
  /** Some write of this message is on its way: nothing in the dialog can be pressed meanwhile. */
  busy: boolean;
  /** What the server refused, in words: it is shown on the field and goes when the host types again. */
  problem: string | null;
  onProblemSeen: () => void;
}

/** The button that was pressed and has not been answered yet: it is the one that shows the work in progress. */
type Pressed = 'save' | 'routine' | null;

/**
 * Changes the text of ONE scheduled message, for this booking only (E05/F07/US02, NF-71): the text of the message as it will read, the data of the stay as buttons that put the variable where the
 * cursor is (CasaZen fills it when the message goes out), the text of the routine one click away while the message is not changed, and «Usa il testo della routine» to clear the change of a message
 * that is. The dialog says that the change is for this booking only.
 *
 * The answer of the server gives the text with its values in place and the link of the check-in, the code of the lock and the link of the review as stand-ins, because a preview issues and releases
 * nothing. The field gets those three as the variables they stand for, so that what is saved is a message that makes them when it goes out, never the brackets of the preview.
 */
export function ScheduledMessageEditDialog({ message, open, onOpenChange, onSave, busy, problem, onProblemSeen }: ScheduledMessageEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <EditDialogBody key={message.id} message={message} onOpenChange={onOpenChange} onSave={onSave} busy={busy} problem={problem} onProblemSeen={onProblemSeen} /> : null}
    </Dialog>
  );
}

function EditDialogBody({ message, onOpenChange, onSave, busy, problem, onProblemSeen }: Omit<ScheduledMessageEditDialogProps, 'open'>) {
  const { t } = useTranslation();
  const variablesLabelId = useId();
  // What the field starts with is what the message says now: it is kept, so that «changed» is judged against it and the text of the routine can be put back.
  const [initial] = useState(() => withVariablesInPlaceOfStandIns(message.text ?? ''));
  const [text, setText] = useState(initial);
  const [pressed, setPressed] = useState<Pressed>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  // Where the cursor goes after a variable was put in: the field is written again first, so the cursor is placed once it has.
  const cursorAfter = useRef<number | null>(null);

  useEffect(() => {
    const position = cursorAfter.current;
    if (position === null) return;
    cursorAfter.current = null;
    area.current?.focus();
    area.current?.setSelectionRange(position, position);
  });

  const typed = text.trim();
  const changed = typed !== initial.trim();
  const tooLong = typed.length > GUEST_MESSAGE_MAX_LENGTH;
  const canSave = changed && typed.length > 0 && !tooLong && !busy;

  const write = (value: string) => {
    setText(value);
    onProblemSeen();
  };

  const insertVariable = (name: string) => {
    const token = `{{${name}}}`;
    const field = area.current;
    const from = field?.selectionStart ?? text.length;
    const to = field?.selectionEnd ?? text.length;
    cursorAfter.current = from + token.length;
    write(`${text.slice(0, from)}${token}${text.slice(to)}`);
  };

  const save = async (which: Exclude<Pressed, null>, value: string | null) => {
    setPressed(which);
    try {
      await onSave(value);
    } finally {
      setPressed(null);
    }
  };

  return (
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" data-testid="scheduled-message-edit-dialog">
      <DialogHeader>
        <DialogTitle>{t('booking.scheduledMessages.edit.title')}</DialogTitle>
        <DialogDescription>{t('booking.scheduledMessages.edit.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Field
          label={t('booking.scheduledMessages.edit.fieldLabel')}
          counter={`${typed.length}/${GUEST_MESSAGE_MAX_LENGTH}`}
          hint={t('booking.scheduledMessages.edit.fieldHint')}
          error={problem ?? (tooLong ? t('booking.scheduledMessages.errors.textInvalid') : undefined)}
        >
          <Textarea ref={area} rows={8} value={text} onChange={(event) => write(event.target.value)} readOnly={busy} data-testid="scheduled-message-edit-text" />
        </Field>

        <div className="space-y-1.5">
          <p className="text-sm font-medium" id={variablesLabelId}>
            {t('booking.scheduledMessages.edit.insertLabel')}
          </p>
          <div role="group" aria-labelledby={variablesLabelId} className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((variable) => (
              <Button
                key={variable.name}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={busy}
                onClick={() => insertVariable(variable.name)}
                data-testid={`scheduled-message-variable-${variable.name}`}
              >
                {t(variable.labelKey)}
              </Button>
            ))}
          </div>
        </div>

        {/* The text of the routine is the text the message has until it is changed: while it is not, it stays here to read (and to put back) as the host works. A changed message goes back to it with the button below. */}
        {!message.edited && initial ? (
          <details className="rounded-md border px-3" data-testid="scheduled-message-original">
            <summary className="flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t('booking.scheduledMessages.edit.originalSummary')}
            </summary>
            <div className="space-y-2 pb-3">
              <ScheduledMessageText text={message.text ?? ''} />
              {changed ? (
                <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={busy} onClick={() => write(initial)} data-testid="scheduled-message-edit-restore">
                  {t('booking.scheduledMessages.edit.restore')}
                </Button>
              ) : null}
            </div>
          </details>
        ) : null}

        {message.edited ? (
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              loading={pressed === 'routine'}
              onClick={() => void save('routine', null)}
              data-testid="scheduled-message-edit-use-routine-text"
            >
              {t('booking.scheduledMessages.edit.useRoutineText')}
            </Button>
            <p className="text-sm text-foreground/70">{t('booking.scheduledMessages.edit.useRoutineTextHint')}</p>
          </div>
        ) : null}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onOpenChange(false)}>
          {t('shared.cancel')}
        </Button>
        <Button
          type="button"
          className="min-h-11"
          disabled={!canSave}
          loading={pressed === 'save'}
          onClick={() => void save('save', withVariablesInPlaceOfStandIns(typed))}
          data-testid="scheduled-message-edit-save"
        >
          {t('booking.scheduledMessages.edit.save')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
