import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useReportReview } from '@/queries/use-reviews';
import { REVIEW_REPORT_NOTE_MAX_LENGTH, REVIEW_REPORT_REASONS, type HostReview, type ReviewReportReason } from '@/types';

interface ReportReviewDialogProps {
  /** The review to report; nothing is drawn without one. */
  review: HostReview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The report of a review to CasaZen (DB-12b): a reason from the list and a note for the staff. It says plainly that the review stays
 * public until CasaZen decides, and that the host cannot hide or delete it. One report per review.
 */
export function ReportReviewDialog({ review, open, onOpenChange }: ReportReviewDialogProps) {
  const { t } = useTranslation();
  const report = useReportReview();
  const [reason, setReason] = useState<ReviewReportReason | ''>('');
  const [note, setNote] = useState('');

  if (!review) return null;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('');
      setNote('');
    }
    onOpenChange(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reason) return;
    report.mutate(
      { reviewId: review.id, payload: { reason, note: note.trim() || undefined } },
      { onSuccess: () => handleOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('hostReviews.report.title')}</DialogTitle>
            <DialogDescription>{t('hostReviews.report.description')}</DialogDescription>
          </DialogHeader>
          <Field label={t('hostReviews.report.reasonLabel')}>
            <Select value={reason} onChange={(event) => setReason(event.target.value as ReviewReportReason | '')} data-testid="review-report-reason">
              <option value="">{t('hostReviews.report.reasonPlaceholder')}</option>
              {REVIEW_REPORT_REASONS.map((value) => (
                <option key={value} value={value}>
                  {t(`hostReviews.report.reasons.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('hostReviews.report.noteLabel')}
            optional
            counter={`${note.length}/${REVIEW_REPORT_NOTE_MAX_LENGTH}`}
          >
            <Textarea value={note} maxLength={REVIEW_REPORT_NOTE_MAX_LENGTH} rows={4} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={report.isPending} onClick={() => handleOpenChange(false)}>
              {t('hostReviews.cancel')}
            </Button>
            <Button type="submit" disabled={report.isPending || !reason} data-testid="review-report-submit">
              {report.isPending ? t('hostReviews.report.sending') : t('hostReviews.report.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
