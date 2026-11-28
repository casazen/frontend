import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { useCloseSelfBilling, useSelfBillingBusy } from '@/queries/use-self-billing';
import type { SelfBillingDetail, SelfBillingListItem } from '@/types';
import { CLOSE_NOTE_MAX, CLOSE_REASONS, closeProblemOf, closeRequestOf, type CloseProblem } from '../self-billing-model';

const keepFromSubmitting = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') event.preventDefault();
};

/**
 * The confirmation of «Chiudi come non più dovuta» of a kept replacement draft (the draft that holds the number of a rejected TD17 when the month no longer supports it): the person says why (one of three reasons, mandatory:
 * the confirmation stays off until one is chosen) and may leave a note (500 characters, with its count), and the dialog says plainly what the closing does: the draft is closed for good, its number stays reserved (it is
 * never given to another invoice) and goes in the register of the unused numbers that the accountant receives, and it cannot be undone. Every refusal has its own words and the dialog stays open: what the server refused is
 * not offered again (not found, already closed, not closable, no access, not open), a reason or a note the server found missing or too long is put right in place, and a call that failed can be asked again with «Riprova» (the
 * same call again with the same reason answers the closed draft, so a double click is not an error). On a 200 the dialog closes and the list and the detail, read again, show the closed draft; nothing is told as done
 * before the server answers. The note is free text that can name a person: it is in the state of this dialog and in the body of the call only, never in the address, the storage or a log, and the mutation is reset as soon
 * as a failure has been read (so its variables, which hold the note, do not stay in the cache of the mutations while the dialog waits for a retry).
 */
export function CloseNotDueDialog({ item, onClose }: { item: SelfBillingListItem; onClose: () => void }) {
  const { t } = useTranslation();
  const close = useCloseSelfBilling();
  const busy = useSelfBillingBusy([item.id]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<{ kind: CloseProblem; words: string } | null>(null);
  const putRight = problem?.kind === 'reasonRequired' || problem?.kind === 'noteTooLong';
  const refused = problem !== null && problem.kind !== 'failed' && !putRight;

  const wordsOf = (kind: CloseProblem, error: unknown): string => {
    switch (kind) {
      case 'reasonRequired':
        return t('selfBilling.close.problem.reasonRequired');
      case 'noteTooLong':
        return t('selfBilling.close.problem.noteTooLong', { max: CLOSE_NOTE_MAX });
      case 'alreadyClosed':
        return t('selfBilling.close.problem.alreadyClosed');
      case 'notClosable':
        return t('selfBilling.close.problem.notClosable');
      case 'notFound':
        return t('selfBilling.close.problem.notFound');
      case 'unavailable':
        return t('selfBilling.close.problem.unavailable');
      case 'forbidden':
        return t('selfBilling.close.problem.forbidden');
      default:
        return getProblemMessage(error, t) ?? t('selfBilling.close.problem.failed');
    }
  };

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open && !close.isPending) onClose();
      }}
      title={t('selfBilling.close.title')}
      description={item.number ? t('selfBilling.close.description', { number: item.number }) : t('selfBilling.close.descriptionUnknown')}
      confirmLabel={problem?.kind === 'failed' ? t('shared.errorState.retry') : t('selfBilling.close.confirm')}
      variant="destructive"
      contentClassName="sm:max-h-[90dvh] sm:overflow-y-auto"
      consequences={[t('selfBilling.close.consequenceClosed'), t('selfBilling.close.consequenceReserved'), t('selfBilling.close.consequenceRegister')]}
      confirmDisabled={reason === '' || refused || busy}
      isLoading={close.isPending}
      onConfirm={async () => {
        setProblem(null);
        let closed: SelfBillingDetail;
        try {
          closed = await close.mutateAsync({ documentId: item.id, request: closeRequestOf(reason, note) });
        } catch (error) {
          const kind = closeProblemOf(error);
          setProblem({ kind, words: wordsOf(kind, error) });
          // The failure is told from the state of this dialog, so the mutation is dropped at once: its variables hold the note (free text that can name a person) and must not stay in the cache of the mutations while the
          // dialog waits for a retry. A retry is a new call with the same reason and note, still in the form.
          close.reset();
          throw error;
        }
        toast.success(closed.invoice.number ? t('selfBilling.close.done', { number: closed.invoice.number }) : t('selfBilling.close.doneUnknown'));
      }}
    >
      <fieldset className="grid gap-1" data-testid="self-billing-close-reasons">
        <legend className="mb-1 text-sm font-medium">{t('selfBilling.close.reasonLegend')}</legend>
        {CLOSE_REASONS.map((code) => (
          <label key={code} className="flex min-h-11 cursor-pointer items-start gap-2 py-2 text-sm">
            <input
              type="radio"
              name="self-billing-close-reason"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              value={code}
              checked={reason === code}
              disabled={close.isPending}
              onKeyDown={keepFromSubmitting}
              onChange={() => {
                setReason(code);
                if (putRight) setProblem(null);
              }}
              data-testid={`self-billing-close-reason-${code}`}
            />
            <span className="min-w-0 break-words">{t(`selfBilling.close.reason.${code}`)}</span>
          </label>
        ))}
      </fieldset>

      <Field label={t('selfBilling.close.note.label')} hint={t('selfBilling.close.note.hint')} optional counter={`${note.length}/${CLOSE_NOTE_MAX}`}>
        <Textarea
          rows={3}
          maxLength={CLOSE_NOTE_MAX}
          value={note}
          disabled={close.isPending}
          onChange={(event) => {
            setNote(event.target.value);
            if (putRight) setProblem(null);
          }}
          data-testid="self-billing-close-note"
        />
      </Field>

      {problem ? (
        <Alert variant="danger" data-testid="self-billing-close-problem" data-problem={problem.kind}>
          {problem.words}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}
