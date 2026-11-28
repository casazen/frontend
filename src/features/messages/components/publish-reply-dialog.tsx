import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';

interface PublishReplyDialogProps {
  text: string | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

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
