import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CAMPAIGN_SUBJECT_MAX_LENGTH,
  MESSAGE_TEXT_MAX_LENGTH,
  editFieldsOf,
  editProblem,
  editedTextOf,
  finalTextOf,
  isCampaign,
  isMessageDraft,
  itemIsGone,
  originActionErrorOf,
  type EditFields,
} from '@/features/approvals/lib/approval-model';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useEditItem, useSaveAndApproveItem } from '@/queries/approvalQueue';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

interface ApprovalEditDialogProps {
  /** The item to edit; `null` while the dialog is closed. */
  item: ApprovalQueueItem | null;
  onClose: () => void;
  /** «Save and approve» went through: the item as the API answered it, with what the approval did. */
  onApproved: (item: ApprovalQueueItem) => void;
  /** The edit was saved and the approval did not go through (the action failed): the item stays open on the page, with the code of the failure. */
  onApproveFailed: (id: string, originCode: string) => void;
}

/**
 * Edit the text of an item before deciding (AC-NF68-2): a message or any other text in one field, a campaign as its subject line and its body (the API
 * keeps a campaign as the subject, a blank line and the body). The original stays visible above the field and can be put back; «Save» keeps the edit
 * for later and «Save and approve» approves it in one step, so what goes out is the edited text.
 */
export function ApprovalEditDialog({ item, onClose, onApproved, onApproveFailed }: ApprovalEditDialogProps) {
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {item ? <EditDialogBody key={item.id} item={item} onClose={onClose} onApproved={onApproved} onApproveFailed={onApproveFailed} /> : null}
    </Dialog>
  );
}

function EditDialogBody({ item, onClose, onApproved, onApproveFailed }: Omit<ApprovalEditDialogProps, 'item'> & { item: ApprovalQueueItem }) {
  const { t } = useTranslation();
  const [initial] = useState<EditFields>(() => editFieldsOf(item, finalTextOf(item)));
  const [fields, setFields] = useState<EditFields>(initial);
  const [attempted, setAttempted] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const edit = useEditItem();
  const saveAndApprove = useSaveAndApproveItem();

  const busy = edit.isPending || saveAndApprove.isPending;
  const campaign = isCampaign(item);
  const problem = editProblem(item, fields);
  const changed = editedTextOf(item, fields) !== editedTextOf(item, initial);
  const original = editFieldsOf(item, item.contentText);
  const differsFromOriginal = editedTextOf(item, fields) !== editedTextOf(item, original);
  const textLength = fields.text.trim().length;

  let description = t('approval.edit.description');
  if (isMessageDraft(item)) description = t('approval.edit.descriptionMessage');
  else if (campaign) description = t('approval.edit.descriptionCampaign');

  const update = (patch: Partial<EditFields>) => {
    setFields((current) => ({ ...current, ...patch }));
    setRefused(null);
  };

  /** What the API answered to a save that did not go through: only a text it refuses stays on the form, the toast of the hook says the rest. */
  const failed = (error: unknown) => {
    const originCode = originActionErrorOf(error);
    if (originCode !== undefined) {
      // The edit is saved: the item stays on the page with its new text and the reason, ready to be approved again.
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

    const text = editedTextOf(item, fields);
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

  const problemFor = (field: 'text' | 'subject' | 'body'): string | undefined => {
    if (problem?.field === field && attempted) {
      return t(problem.key, problem.max === undefined ? undefined : { max: problem.max });
    }
    return field === (campaign ? 'body' : 'text') ? (refused ?? undefined) : undefined;
  };

  return (
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" data-testid="approval-edit-dialog">
      <DialogHeader>
        <DialogTitle>{t('approval.edit.title')}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t('approval.edit.original')}</p>
          {/* A region that scrolls takes the focus, so that the keyboard can read all of it. */}
          <div
            role="region"
            tabIndex={0}
            aria-label={t('approval.edit.original')}
            className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm"
            data-testid="approval-edit-original"
          >
            {item.contentText}
          </div>
        </div>

        {campaign ? (
          <>
            <Field
              label={t('approval.edit.subjectLabel')}
              counter={`${fields.subject.trim().length}/${CAMPAIGN_SUBJECT_MAX_LENGTH}`}
              error={problemFor('subject')}
            >
              <Input value={fields.subject} onChange={(event) => update({ subject: event.target.value })} readOnly={busy} />
            </Field>
            <Field label={t('approval.edit.bodyLabel')} hint={t('approval.edit.campaignHint')} error={problemFor('body')}>
              <Textarea rows={8} value={fields.body} onChange={(event) => update({ body: event.target.value })} readOnly={busy} />
            </Field>
          </>
        ) : (
          <Field
            label={t('approval.edit.textLabel')}
            counter={isMessageDraft(item) ? `${textLength}/${MESSAGE_TEXT_MAX_LENGTH}` : undefined}
            error={problemFor('text')}
          >
            <Textarea rows={8} value={fields.text} onChange={(event) => update({ text: event.target.value })} readOnly={busy} />
          </Field>
        )}

        {differsFromOriginal ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => update(original)} disabled={busy}>
            {t('approval.edit.restore')}
          </Button>
        ) : null}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t('shared.cancel')}
        </Button>
        <Button type="button" variant="outline" onClick={() => submit(false)} disabled={busy || !changed} loading={edit.isPending}>
          {t('approval.action.save')}
        </Button>
        <Button type="button" onClick={() => submit(true)} disabled={busy && !saveAndApprove.isPending} loading={saveAndApprove.isPending}>
          {t('approval.action.saveAndApprove')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
