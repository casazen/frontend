import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { leaseDocumentsApi } from '@/api/lease-documents.api';
import { leasesApi } from '@/api/leases.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs, withJsonErrorBody } from '@/lib/file-download';
import { cn } from '@/lib/utils';
import { useLeaseDocuments } from '@/queries/use-lease-documents';
import type { LeaseDetail } from '@/types';
import {
  BENEFIT_DOCUMENTS,
  BENEFIT_DOCUMENT_KIND,
  BENEFIT_TEXT,
  benefitSource,
  type BenefitDocument,
  type BenefitSource,
} from '../lib/lease-benefits';
import { LeaseDocumentUploadDialog } from './lease-document-upload-dialog';

/** A button of a row: 44 px high and a long label wraps instead of pushing the page sideways. */
const ROW_BUTTON = 'h-auto min-h-11 min-w-0 whitespace-normal py-2 text-center leading-tight sm:shrink-0';

interface RegisteredBenefitsProps {
  lease: Pick<LeaseDetail, 'id' | 'hasSignedPdf' | 'registration'>;
  /**
   * The block is the one highlighted block of the screen (default), or it comes after another step that is more urgent and is only a
   * quiet section under it: a sheet shows one highlighted block, never two.
   */
  calm?: boolean;
  /**
   * The block is one row among the advice of the guide of the lease (LR-GUIDE-1): no box, no side line, its title an `h3` under the
   * section «Per il tuo contratto». It is the same block with the same words, the one place that tells what to claim after a registration.
   */
  plain?: boolean;
}

/**
 * «Contratto registrato: ora fai valere le agevolazioni»: what follows a registered canone concordato. The person brings a copy of
 * three documents (the signed contract, the attestation and the receipt of the registration) to the accountant and to the comune to
 * obtain the benefits of the contract, and each one that exists has its «Scarica»; one that does not exist is said to be missing, with
 * the button that uploads it. The two figures are those the rules of CasaZen state for a canone concordato (the IMU reduced by 25%, the
 * cedolare secca at 10% where it is provided for); which comuni provide for it and the conditions of each are not listed here, and the
 * last sentence sends the person to the accountant for them. Nothing here is advice: it only tells what to bring and where it is.
 */
export function RegisteredBenefits({ lease, calm = false, plain = false }: RegisteredBenefitsProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const Heading = plain ? 'h3' : 'h2';
  const documents = useLeaseDocuments(lease.id);
  // The window is for the document whose button opened it; it keeps that one while it closes.
  const [uploadFor, setUploadFor] = useState<BenefitDocument>('attestation');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloading, setDownloading] = useState<BenefitDocument | null>(null);

  const rows = BENEFIT_DOCUMENTS.map((id) => ({ id, source: benefitSource(id, lease, documents.data) }));
  const missing = rows.filter((row) => row.source === null).length;
  const unreadable = documents.isError && rows.some((row) => row.source === undefined);

  async function download(id: BenefitDocument, source: BenefitSource) {
    if (downloading) return;
    setDownloading(id);
    try {
      if (source.from === 'signed') saveBlobAs(await leasesApi.downloadSignedContract(lease.id), `contratto-firmato-${lease.id}.pdf`);
      else if (source.from === 'receipt') saveBlobAs(await leasesApi.downloadReceipt(lease.id), `ricevuta-rli-${lease.id}.pdf`);
      else saveBlobAs(await leaseDocumentsApi.download(lease.id, source.document.id), source.document.fileName);
    } catch (error) {
      toast.error(getProblemMessage(await withJsonErrorBody(error), t) ?? t('cfDocuments.downloadError'));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      data-testid="lease-benefits"
      data-variant={plain ? 'plain' : calm ? 'calm' : 'focus'}
      className={cn(
        'min-w-0',
        plain
          ? ''
          : calm
            ? 'border-s-2 border-border ps-4'
            : 'flex flex-col gap-3 rounded-xl bg-success-soft p-4 ring-1 ring-inset ring-success-border sm:flex-row sm:gap-4 sm:p-6',
      )}
    >
      {calm || plain ? null : (
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-success-foreground sm:size-12">
          <CheckCircle2 className="size-5 sm:size-6" />
        </span>
      )}

      <div className="min-w-0 flex-1 space-y-3">
        <Heading id={titleId} className={cn('break-words font-semibold leading-snug', calm || plain ? 'text-base' : 'text-lg sm:text-xl')}>
          {t('leaseRound.benefits.title')}
        </Heading>
        <div className="space-y-2 break-words text-sm text-foreground/80 sm:text-base">
          <p>{t('leaseRound.benefits.intro')}</p>
          <p className="text-foreground/70">{t('leaseRound.benefits.use')}</p>
        </div>

        {missing > 0 ? (
          <p className="break-words text-sm font-medium" data-testid="lease-benefits-missing">
            {t('leaseRound.benefits.missing', { count: missing })}
          </p>
        ) : null}

        {unreadable ? (
          <Alert
            variant="warning"
            action={
              <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void documents.refetch()}>
                {t('leases.retry')}
              </Button>
            }
          >
            {t('cfDocuments.documentsError')}
          </Alert>
        ) : null}

        <ul role="list" className="divide-y divide-foreground/10">
          {rows.map(({ id, source }) => {
            const name = t(BENEFIT_TEXT[id].nameKey);
            return (
              <li key={id} data-testid={`lease-benefit-${id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-0.5">
                  {source === null ? (
                    <p className="break-words font-medium">{t('leaseRound.benefits.missingLine', { name })}</p>
                  ) : (
                    <>
                      <p className="break-words font-medium">{name}</p>
                      {source?.from === 'document' ? <p className="break-all text-sm text-foreground/70">{source.document.fileName}</p> : null}
                    </>
                  )}
                </div>
                {source === null ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={ROW_BUTTON}
                    onClick={() => {
                      setUploadFor(id);
                      setUploadOpen(true);
                    }}
                    data-testid={`lease-benefit-upload-${id}`}
                  >
                    {t(BENEFIT_TEXT[id].uploadKey)}
                  </Button>
                ) : source ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={ROW_BUTTON}
                    loading={downloading === id}
                    aria-label={t('leaseRound.benefits.downloadOne', { name })}
                    onClick={() => void download(id, source)}
                    data-testid={`lease-benefit-download-${id}`}
                  >
                    {t('cfDocuments.download')}
                  </Button>
                ) : documents.isPending ? (
                  <span role="status" className="text-sm text-foreground/70">
                    {t('leaseRound.benefits.loading')}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="break-words text-sm text-foreground/70">{t('leaseRound.benefits.disclaimer')}</p>
      </div>

      {/* Always mounted, not inside the rows: a window that lives in a branch is lost when the branch changes. */}
      <LeaseDocumentUploadDialog
        leaseId={lease.id}
        kind={BENEFIT_DOCUMENT_KIND[uploadFor]}
        title={t(BENEFIT_TEXT[uploadFor].uploadKey)}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </section>
  );
}
