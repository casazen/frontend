import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useReplyToReview } from '@/queries/use-reviews';
import { REVIEW_REPLY_MAX_LENGTH, type HostReview } from '@/types';

interface ReplyReviewDialogProps {
  /** The review to answer; nothing is drawn without one. */
  review: HostReview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The one answer of the host to a review (DB-12b): written once, shown under the review on the public page, and not editable
 * afterwards. An error is told by the toast of the mutation and leaves the dialog open with the text.
 */
export function ReplyReviewDialog({ review, open, onOpenChange }: ReplyReviewDialogProps) {
  const { t } = useTranslation();
  const reply = useReplyToReview();
  const [text, setText] = useState('');

  if (!review) return null;

  const handleOpenChange = (next: boolean) => {
    if (!next) setText('');
    onOpenChange(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const answer = text.trim();
    if (!answer) return;
    reply.mutate({ reviewId: review.id, text: answer }, { onSuccess: () => handleOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('hostReviews.reply.title')}</DialogTitle>
            <DialogDescription>{t('hostReviews.reply.description', { author: review.authorName })}</DialogDescription>
          </DialogHeader>
          <Field label={t('hostReviews.reply.label')} counter={`${text.length}/${REVIEW_REPLY_MAX_LENGTH}`} hint={t('hostReviews.reply.once')}>
            <Textarea
              value={text}
              maxLength={REVIEW_REPLY_MAX_LENGTH}
              rows={5}
              onChange={(event) => setText(event.target.value)}
              data-testid="review-reply-text"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={reply.isPending} onClick={() => handleOpenChange(false)}>
              {t('hostReviews.cancel')}
            </Button>
            <Button type="submit" disabled={reply.isPending || text.trim().length === 0} data-testid="review-reply-submit">
              {reply.isPending ? t('hostReviews.reply.sending') : t('hostReviews.reply.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
