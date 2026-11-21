import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';

interface PublishReplyDialogProps {
  /** The exact words that would go out; `null` while the dialog is closed. */
  text: string | null;
  /** The send is going on: the buttons wait for it. */
  isLoading: boolean;
  onClose: () => void;
  /** Sends the reply. A failure is told by the caller (the toast of its hook and the state of the review): the dialog closes either way. */
  onConfirm: () => Promise<void>;
}

/**
 * The question before a public reply goes out (E05/F06/US02, AC-NF69-2): a reply to a review is read by everybody who reads the review, it cannot be taken back and it cannot be edited, so the
 * dialog says so and shows the words exactly as they will be published. It is drawn outside of any form of the page (the dialog of the kit stops its own submit, but nothing here depends on it).
 */
export function PublishReplyDialog({ text, isLoading, onClose, onConfirm }: PublishReplyDialogProps) {
  const { t } = useTranslation();

  return (
    <ConfirmationDialog
      open={text !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('reviews.thread.confirm.title')}
      description={t('reviews.thread.confirm.description')}
      confirmLabel={t('reviews.thread.confirm.publish')}
      consequences={[t('reviews.thread.confirm.public'), t('reviews.thread.confirm.once')]}
      isLoading={isLoading}
      onConfirm={onConfirm}
    >
      {text !== null ? (
        <blockquote className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm" data-testid="review-publish-text">
          {text}
        </blockquote>
      ) : null}
    </ConfirmationDialog>
  );
}
