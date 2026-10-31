import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { SupplierServiceRequest } from '@/types/service-request';
import { BLOCK_NOT_SENT, NEEDS_OFFER, NOT_IN_BLOCK, type BulkAcceptFailure } from './bulk-accept';
import { requestPath, requestTitle, requestWhen } from './request-model';

/** What the supplier is told after taking many requests at once when some of them were not taken: how many were, and each one that was not. */
export interface BulkAcceptSummary {
  accepted: number;
  failed: BulkAcceptFailure[];
  /** The requests that were selected, to name the ones that failed. */
  rows: ReadonlyMap<string, SupplierServiceRequest>;
}

/** Why a request was not taken: in the words of the server when it gave them (the job overlaps one already accepted, it changed meanwhile...). */
function reasonOf(failure: BulkAcceptFailure, t: (key: string) => string): string {
  if (failure.message) return failure.message;
  if (failure.code === NOT_IN_BLOCK) return t('supplier.requests.bulk.summary.notInBulk');
  if (failure.code === NEEDS_OFFER) return t('supplier.requests.bulk.summary.needsOffer');
  if (failure.code === BLOCK_NOT_SENT) return t('supplier.requests.bulk.summary.notSent');
  return t('supplier.requests.bulk.summary.unknown');
}

/**
 * The outcome per request of "Accetta le selezionate" (SP-08b), shown only when some were not taken: never one generic error. Each request
 * that was not taken says why and leads to its own page, where the supplier can answer it one by one (another time, a quote, a refusal).
 * The ones that were taken are only counted: they are already in "Programmate".
 */
export function BulkAcceptDialog({ summary, onClose }: { summary: BulkAcceptSummary; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const failed = summary.failed.length;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="bulk-accept-summary">
        <DialogHeader>
          <DialogTitle>
            {summary.accepted > 0
              ? t('supplier.requests.bulk.summary.titleSome', { accepted: summary.accepted, count: failed })
              : t('supplier.requests.bulk.summary.titleNone', { count: failed })}
          </DialogTitle>
          <DialogDescription>{t('supplier.requests.bulk.summary.description', { count: failed })}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] space-y-3 overflow-y-auto" aria-label={t('supplier.requests.bulk.summary.list')}>
          {summary.failed.map((failure) => {
            const row = summary.rows.get(failure.id);
            const when = row ? requestWhen(row, i18n.language) : null;
            return (
              <li key={failure.id} className="rounded-md border p-3" data-testid={`bulk-accept-failed-${failure.id}`} data-code={failure.code ?? undefined}>
                <p className="break-words font-semibold">{row ? requestTitle(row, t) : t('supplier.requests.requestTitle')}</p>
                {when?.day ? <p className="break-words text-sm text-foreground/70">{[when.day, when.time].filter(Boolean).join(' · ')}</p> : null}
                <p className="mt-1 break-words">{reasonOf(failure, t)}</p>
                <Link
                  to={requestPath(failure.id)}
                  onClick={onClose}
                  className="mt-2 inline-flex min-h-9 items-center rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                >
                  {t('supplier.requests.bulk.summary.open')}
                </Link>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={onClose} data-testid="bulk-accept-summary-close">
            {t('supplier.requests.bulk.summary.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
