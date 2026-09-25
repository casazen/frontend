import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApproveSeoRevision, useSeoPageDetail } from '@/queries/use-admin-seo';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { formatDateTime } from '@/lib/utils';
import type { SeoReviewEvent, SeoRevisionPreview } from '@/types/seo.types';
import { contentStatusKey, isPublishableContent, SEO_REVIEW_NOTE_MAX_LENGTH } from './seo-review-helpers';

interface SeoReviewDialogProps {
  /** Page under review; null closes the dialog. Mount it with `key={pageId}` so the form restarts for each page. */
  pageId: string | null;
  onClose: () => void;
}

/**
 * Review of an SEO page (SE-01, A8-04, A8-21): the text waiting for approval next to the published one, both as the public
 * page shows them (sanitized), the review history, and the approval of the exact revision read, with an explicit legal
 * review confirmation and an optional note kept in the audit.
 */
export function SeoReviewDialog({ pageId, onClose }: SeoReviewDialogProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSeoPageDetail(pageId);
  const approveMutation = useApproveSeoRevision();
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState('');

  const pending = data?.pendingRevision ?? null;
  const pendingPublishable = pending !== null && isPublishableContent(pending.contentStatus);
  const canApprove = pendingPublishable && confirmed && !approveMutation.isPending;

  function handleApprove() {
    if (!data || !pending) return;
    const trimmed = note.trim();
    approveMutation.mutate(
      {
        pageId: data.page.id,
        body: { revisionId: pending.id, counselApproved: confirmed, ...(trimmed ? { note: trimmed } : {}) },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open={pageId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto" data-testid="seo-review-dialog">
        <DialogHeader>
          <DialogTitle>
            {data ? t('admin.seo.review.title', { title: data.page.title }) : t('admin.seo.review.loading')}
          </DialogTitle>
          <DialogDescription>{t('admin.seo.review.description')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-muted-foreground">{t('admin.seo.review.loading')}</p>
        ) : isError || !data ? (
          <p className="py-6 text-center text-destructive" data-testid="seo-review-error">
            {t('admin.seo.review.loadError')}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <RevisionPanel
                heading={t('admin.seo.review.pendingHeading')}
                revision={pending}
                published={false}
                emptyText={t('admin.seo.review.noPending')}
                testId="seo-review-pending"
              />
              <RevisionPanel
                heading={t('admin.seo.review.publishedHeading')}
                revision={data.publishedRevision}
                published
                emptyText={t('admin.seo.review.notPublished')}
                testId="seo-review-published"
              />
            </div>

            {pending && !pendingPublishable && (
              <p className="text-sm text-destructive" data-testid="seo-review-not-publishable">
                {t('admin.seo.review.notPublishable')}
              </p>
            )}

            {pendingPublishable && (
              <div className="space-y-3 rounded-md border p-4">
                {data.page.counselRequired && (
                  <p className="text-sm text-muted-foreground">{t('admin.seo.review.counselHint')}</p>
                )}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="seo-review-confirm"
                    checked={confirmed}
                    onCheckedChange={(value) => setConfirmed(value === true)}
                    data-testid="seo-review-confirm"
                  />
                  <Label htmlFor="seo-review-confirm" className="text-sm font-normal leading-snug">
                    {data.page.counselRequired
                      ? t('admin.seo.review.confirmCounsel')
                      : t('admin.seo.review.confirmReview')}
                  </Label>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="seo-review-note">{t('admin.seo.review.noteLabel')}</Label>
                  <Textarea
                    id="seo-review-note"
                    value={note}
                    maxLength={SEO_REVIEW_NOTE_MAX_LENGTH}
                    placeholder={t('admin.seo.review.notePlaceholder')}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              </div>
            )}

            <ReviewHistory events={data.reviewHistory} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('admin.seo.review.close')}
          </Button>
          {pendingPublishable && (
            <Button onClick={handleApprove} disabled={!canApprove} data-testid="seo-review-approve">
              {t('admin.seo.review.approve')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RevisionPanelProps {
  heading: string;
  revision: SeoRevisionPreview | null;
  published: boolean;
  emptyText: string;
  testId: string;
}

function RevisionPanel({ heading, revision, published, emptyText, testId }: RevisionPanelProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2 rounded-md border p-4" data-testid={testId}>
      <h3 className="font-semibold">{heading}</h3>
      {!revision ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {[
              t('admin.seo.review.generatedAt', { date: formatDateTime(revision.generatedAt) }),
              revision.promptVersion ? t('admin.seo.review.promptVersion', { version: revision.promptVersion }) : null,
              t(contentStatusKey(revision.contentStatus, published)),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {revision.bodyHtml ? (
            <article
              className="prose prose-sm prose-neutral max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(revision.bodyHtml) }}
              data-testid={`${testId}-body`}
            />
          ) : (
            <p className="text-sm text-destructive">{t(contentStatusKey(revision.contentStatus, published))}</p>
          )}
        </>
      )}
    </section>
  );
}

function ReviewHistory({ events }: { events: SeoReviewEvent[] }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2" data-testid="seo-review-history">
      <h3 className="font-semibold">{t('admin.seo.review.history')}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.seo.review.historyEmpty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {events.map((event) => {
            const values = { actor: event.actorUserId, date: formatDateTime(event.occurredAt) };
            return (
              <li key={`${event.action}-${event.occurredAt}`}>
                {event.action === 'Approved'
                  ? t('admin.seo.review.historyApproved', values)
                  : t('admin.seo.review.historyWithdrawn', values)}
                {event.note && (
                  <span className="ml-2 text-muted-foreground">
                    {t('admin.seo.review.historyNote', { note: event.note })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
