import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ReportAccessDeniedError, type ReportFileFormat } from '@/api/report-files';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getProblemMessage } from '@/lib/api-errors';
import { useOwnerNames } from '@/queries/use-owner-accounting';
import { useDownloadTaxFile } from '@/queries/withholding';
import type { TaxReportingDataset } from '@/types';
import { messageOf, shortId } from '../owner-accounting-model';
import { cuOwnerIdsOf, type TaxExportRequest } from '../tax-exports-model';
import { useOwnerFormat } from '../use-owner-format';
import { FilingStatus } from './filing-status';

/** What a failed export says, in words: a role that may not read the file, the sentence of the code of any other (no annual data yet, nothing withheld in the period, data of before the recipients), else that the file did not come. */
function exportProblemOf(error: unknown, t: TFunction): string {
  if (error instanceof ReportAccessDeniedError) return t('ownerAccounting.exports.noAccess');
  return getProblemMessage(error, t) ?? t('ownerAccounting.exports.failed');
}

/** The two formats a file of the withholding can be made in: the CSV for a spreadsheet set to Italian, the Excel file the accountant opens. */
const FORMATS: readonly ReportFileFormat[] = ['csv', 'xlsx'];

interface FormatButtonsProps {
  id: string;
  /** What the file is, for a screen reader that reads the buttons of the page one after the other. */
  title: string;
  /** The format being made now (the request of this row that is on its way), if any. */
  pending: ReportFileFormat | null;
  disabled: boolean;
  onDownload: (format: ReportFileFormat) => void;
}

/** «CSV» and «Excel» of one file: the CSV for a spreadsheet set to Italian, the Excel file the accountant opens. */
function FormatButtons({ id, title, pending, disabled, onDownload }: FormatButtonsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {FORMATS.map((format) => {
        const label = t(`ownerAccounting.exports.format.${format}`);
        return (
          <Button
            key={format}
            type="button"
            size="sm"
            variant="outline"
            loading={pending === format}
            disabled={disabled}
            aria-label={t('ownerAccounting.exports.formatFor', { format: label, title })}
            onClick={() => onDownload(format)}
            data-testid={`tax-export-${id}-${format}`}
          >
            <Download aria-hidden="true" className="size-4" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

interface ExportRowProps {
  id: string;
  title: string;
  description: string;
  disabled: boolean;
  pending: ReportFileFormat | null;
  failure: string | null;
  /** What waits under the buttons: a way to the step before, or the list of the owners. */
  children?: ReactNode;
  onDownload: (format: ReportFileFormat) => void;
}

function ExportRow({ id, title, description, disabled, pending, failure, children, onDownload }: ExportRowProps) {
  return (
    <li className="min-w-0 space-y-2 py-3" data-testid={`tax-export-${id}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="break-words text-base font-semibold">{title}</p>
          <p className="break-words text-sm text-foreground/70">{description}</p>
        </div>
        <FormatButtons id={id} title={title} pending={pending} disabled={disabled} onDownload={onDownload} />
      </div>
      {children}
      {failure ? (
        <p role="alert" className="break-words text-sm text-destructive" data-testid={`tax-export-${id}-failure`}>
          {failure}
        </p>
      ) : null}
    </li>
  );
}

interface ProspectListProps {
  year: number;
  dataset: TaxReportingDataset;
  disabled: boolean;
  /** The owner whose prospect is being made now. */
  pendingOwner: string | null;
  failure: { ownerId: string; message: string } | null;
  onDownload: (ownerId: string) => void;
}

/**
 * The draft «prospetto CU» of each owner the annual data has a record for, one PDF each, with the watermark that says it is a draft and not the Certificazione Unica. The owners are the ones of the totals of the annual
 * data (`payloadJson`), named from the registry of the agency; a payload that is not that list says so instead of listing no one.
 */
function ProspectList({ year, dataset, disabled, pendingOwner, failure, onDownload }: ProspectListProps) {
  const { t } = useTranslation();
  const owners = useOwnerNames();
  const ownerIds = cuOwnerIdsOf(dataset.payloadJson);
  const names = new Map((owners.data ?? []).map((owner) => [owner.id, `${owner.firstName} ${owner.lastName}`.trim()] as const));

  return (
    <details className="min-w-0 rounded-md border border-border px-3" data-testid="tax-export-cu-prospects">
      <summary className="flex min-h-11 cursor-pointer list-none items-center font-medium [&::-webkit-details-marker]:hidden">{t('ownerAccounting.exports.cu.prospectsTitle', { count: ownerIds?.length ?? 0 })}</summary>
      <div className="space-y-2 pb-3">
        <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.exports.cu.prospectsHint', { year })}</p>
        {ownerIds === null ? (
          <p className="break-words text-sm" data-testid="tax-export-cu-prospects-unreadable">
            {t('ownerAccounting.exports.cu.prospectsUnreadable')}
          </p>
        ) : ownerIds.length === 0 ? (
          <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.exports.cu.prospectsNone')}</p>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {ownerIds.map((ownerId) => {
              const name = names.get(ownerId) ?? t('ownerAccounting.owner.unnamed', { id: shortId(ownerId) });
              return (
                <li key={ownerId} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between" data-testid={`tax-export-cu-prospect-${ownerId}`}>
                  <span className="min-w-0 break-words">{name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={pendingOwner === ownerId}
                    disabled={disabled}
                    aria-label={t('ownerAccounting.exports.cu.prospectFor', { owner: name })}
                    onClick={() => onDownload(ownerId)}
                    data-testid={`tax-export-cu-prospect-pdf-${ownerId}`}
                  >
                    <Download aria-hidden="true" className="size-4" />
                    {t('ownerAccounting.exports.cu.prospectPdf')}
                  </Button>
                  {failure?.ownerId === ownerId ? (
                    <p role="alert" className="break-words text-sm text-destructive sm:basis-full" data-testid="tax-export-cu-prospect-failure">
                      {failure.message}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

interface TaxExportsSectionProps {
  year: number;
  /** The month whose F24 data is offered; `null` when the month has no withholding to put in an F24 (nothing is offered then). */
  month: number | null;
  /** The annual data of the year: `undefined` while they are read (or the read failed), `null` when they were never generated, then there is no CU to export. */
  dataset: TaxReportingDataset | null | undefined;
  /** The read of the annual data failed: the CU says so, with the way to read them again, instead of waiting for data that is not coming. */
  datasetError?: { error: unknown; onRetry: () => void };
  /** A file of the page is being made again (the F24, the annual data): the files read the same data, so none is asked until it is made. */
  busy?: boolean;
  /** Where the annual data are generated when there are none: the month-end close of the month. */
  closeHref?: string;
  /** The section is a part of another one (it has an `h3`, not an `h2`). */
  nested?: boolean;
}

/** What one request is for: the row of the page that asked it, to put its failure under it. */
function rowOf(request: TaxExportRequest): string {
  return request.kind === 'cuProspect' ? `cuProspect:${request.ownerId}` : request.kind;
}

/**
 * The files the agency hands to its accountant for the Italian withholding (E18/F01/US01/T02, E18/F01/US02, NF-117, ⚖ T2): the data of the F24 of the month, the Certificazione Unica of the year (CSV or Excel for every recipient,
 * and a draft «prospetto» in PDF for each owner), the 770 and the communication of the short-let contracts due by 30 June of the next year. CasaZen prepares the data and files nothing, and says so: the form is filled in, and
 * sent, by the accountant. The F24 data exists whatever the flag says (the backend does not gate it); the rest is behind `taxReportingExports`, as it is at the server.
 *
 * Every file is made on request, saved and let go (nothing keeps it), through the authenticated client. While one is on its way no other is asked, a second click does nothing, and a failure is told under the file it
 * belongs to in words (a role that may not read it, no annual data yet, nothing withheld in the period), never as a file that is empty.
 */
export function TaxExportsSection({ year, month, dataset, datasetError, busy = false, closeHref, nested = false }: TaxExportsSectionProps) {
  const { t } = useTranslation();
  const { month: monthName } = useOwnerFormat();
  const { flags } = useFeatureFlags();
  const tax = isFeatureEnabled(flags, 'taxReportingExports');
  const download = useDownloadTaxFile();
  const [failure, setFailure] = useState<{ row: string; message: string } | null>(null);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second one in between is stopped here.
  const sending = useRef(false);
  const working = busy || download.isPending;
  const pendingRequest = download.isPending ? download.variables : undefined;
  const pendingFormat = (kind: TaxExportRequest['kind']): ReportFileFormat | null =>
    pendingRequest && pendingRequest.kind === kind && 'format' in pendingRequest ? pendingRequest.format : null;

  const start = async (request: TaxExportRequest) => {
    if (busy || sending.current) return;
    sending.current = true;
    setFailure(null);
    try {
      await download.mutateAsync(request);
    } catch (error) {
      setFailure({ row: rowOf(request), message: exportProblemOf(error, t) });
    } finally {
      sending.current = false;
    }
  };
  const failureOf = (row: string) => (failure?.row === row ? failure.message : null);

  const cuReady = dataset !== undefined && dataset !== null;
  const hasRows = month !== null || tax;
  if (!hasRows) return null;

  const title = t('ownerAccounting.exports.title');
  const body = (
    <>
      <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.exports.note')}</p>
      <ul role="list" className="divide-y divide-border">
        {month !== null ? (
          <ExportRow
            id="f24"
            title={t('ownerAccounting.exports.f24.title', { period: monthName(year, month) })}
            description={t('ownerAccounting.exports.f24.description')}
            disabled={working}
            pending={pendingFormat('f24')}
            failure={failureOf('f24')}
            onDownload={(format) => void start({ kind: 'f24', year, month, format })}
          />
        ) : null}
        {tax ? (
          <>
            <ExportRow
              id="cu"
              title={t('ownerAccounting.exports.cu.title', { year })}
              description={t('ownerAccounting.exports.cu.description')}
              disabled={working || !cuReady}
              pending={pendingFormat('cu')}
              failure={failureOf('cu')}
              onDownload={(format) => void start({ kind: 'cu', year, format })}
            >
              {dataset === null ? (
                <p className="break-words text-sm" data-testid="tax-export-cu-none">
                  {t('ownerAccounting.exports.cu.none')}
                  {closeHref ? (
                    <>
                      {' '}
                      <Link to={closeHref} className="font-medium text-primary underline underline-offset-4">
                        {t('ownerAccounting.exports.cu.openClose')}
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
              {datasetError ? (
                <Alert
                  variant="danger"
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={datasetError.onRetry}>
                      {t('shared.errorState.retry')}
                    </Button>
                  }
                  data-testid="tax-export-cu-load-error"
                >
                  {messageOf(datasetError.error, t)}
                </Alert>
              ) : null}
              {/* On a page of its own the CU says where it stands (the panel of the month-end has the state of the file above). */}
              {cuReady && !nested ? <FilingStatus file={dataset} /> : null}
              {cuReady ? (
                <ProspectList
                  year={year}
                  dataset={dataset}
                  disabled={working}
                  pendingOwner={pendingRequest?.kind === 'cuProspect' ? pendingRequest.ownerId : null}
                  failure={failure?.row.startsWith('cuProspect:') ? { ownerId: failure.row.slice('cuProspect:'.length), message: failure.message } : null}
                  onDownload={(ownerId) => void start({ kind: 'cuProspect', year, ownerId })}
                />
              ) : null}
            </ExportRow>
            <ExportRow
              id="tax770"
              title={t('ownerAccounting.exports.tax770.title', { year })}
              description={t('ownerAccounting.exports.tax770.description')}
              disabled={working}
              pending={pendingFormat('tax770')}
              failure={failureOf('tax770')}
              onDownload={(format) => void start({ kind: 'tax770', year, format })}
            />
            <ExportRow
              id="contracts"
              title={t('ownerAccounting.exports.contracts.title', { year })}
              description={t('ownerAccounting.exports.contracts.description', { deadlineYear: year + 1 })}
              disabled={working}
              pending={pendingFormat('contracts')}
              failure={failureOf('contracts')}
              onDownload={(format) => void start({ kind: 'contracts', year, format })}
            />
          </>
        ) : null}
      </ul>
    </>
  );

  // Inside another section of a page (the tax panel of the month-end) it is a part of it with an `h3`; on a page of its own it is a section.
  return nested ? (
    <div className="space-y-2" data-testid="tax-exports">
      <h3 className="text-base font-semibold">{title}</h3>
      {body}
    </div>
  ) : (
    <PlainSection title={title} data-testid="tax-exports">
      {body}
    </PlainSection>
  );
}
