import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { MESSAGE_TEXT_MAX_LENGTH, editProblem, finalTextOf, itemIsGone, originActionErrorOf } from '@/features/approvals/lib/approval-model';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import type { useEditItem, useSaveAndApproveItem } from '@/queries/approvalQueue';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

interface DraftEditorProps {
  /** The draft being edited. The field starts from the text the approval would act with (the host's earlier edit, else the draft). */
  item: ApprovalQueueItem;
  /** The mutations belong to the panel: it keeps every button waiting while any request of the draft goes on. */
  edit: ReturnType<typeof useEditItem>;
  saveAndApprove: ReturnType<typeof useSaveAndApproveItem>;
  /** Any request of the panel is going on (an approval, an edit, a rejection, a request for a draft). */
  busy: boolean;
  onClose: () => void;
  /** «Save and approve» went through: the item as the API answered it, with what the approval did. */
  onApproved: (item: ApprovalQueueItem) => void;
  /** The edit was saved and the approval did not go through (the action failed): the draft stays open on the panel with the code of the failure. */
  onApproveFailed: (id: string, originCode: string) => void;
}

/**
 * The inline editor of a draft (NF-68, AC-NF68-2): the text of the message in a box, «Save» to keep the edit for later and «Save and approve» to send the edited
 * text in one step, so that what goes out is the one on the screen. The rules are the ones of the approval queue (not empty, at most 2,000 characters); the API stays
 * the judge and a text it refuses (422) stays on the box with its reason. The text is a message to a guest: nothing here logs or stores it.
 */
export function DraftEditor({ item, edit, saveAndApprove, busy, onClose, onApproved, onApproveFailed }: DraftEditorProps) {
  const { t } = useTranslation();
  const [initial] = useState(() => finalTextOf(item));
  const [text, setText] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const problem = editProblem(item, { text, subject: '', body: '' });
  const changed = text !== initial;

  /** What the API answered to a save that did not go through: only a text it refuses stays on the box; the toast of the hook says the rest. */
  const failed = (error: unknown) => {
    const originCode = originActionErrorOf(error);
    if (originCode !== undefined) {
      // The edit is saved: the draft stays on the panel with its new text and the reason, ready to be approved again.
      onApproveFailed(item.id, originCode);
      onClose();
    } else if (itemIsGone(error)) {
      onClose();
    } else if (getHttpStatus(error) === 422) {
      setRefused(getProblemMessage(error, t) ?? t('approval.edit.invalid'));
    }
  };

  const submit = (approve: boolean) => {
    setAttempted(true);
    if (problem) return;

    if (approve) {
      saveAndApprove.mutate(
        { id: item.id, text },
        {
          onSuccess: (approved) => {
            onApproved(approved);
            onClose();
          },
          onError: failed,
        },
      );
      return;
    }
    edit.mutate({ id: item.id, text }, { onSuccess: onClose, onError: failed });
  };

  const error = attempted && problem ? t(problem.key, problem.max === undefined ? undefined : { max: problem.max }) : (refused ?? undefined);

  return (
    <div className="space-y-3" data-testid="assistant-draft-editor">
      <Field label={t('approval.edit.textLabel')} counter={`${text.trim().length}/${MESSAGE_TEXT_MAX_LENGTH}`} error={error}>
        <Textarea
          rows={8}
          value={text}
          readOnly={busy}
          onChange={(event) => {
            setText(event.target.value);
            setRefused(null);
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="min-h-11" onClick={() => submit(true)} loading={saveAndApprove.isPending} disabled={busy && !saveAndApprove.isPending}>
          {t('approval.action.saveAndApprove')}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => submit(false)} loading={edit.isPending} disabled={busy || !changed}>
          {t('approval.action.save')}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={onClose} disabled={busy}>
          {t('shared.cancel')}
        </Button>
      </div>
    </div>
  );
}
