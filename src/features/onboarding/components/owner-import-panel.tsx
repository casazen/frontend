import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import {
  isOwnerImportFileName,
  OWNER_IMPORT_MAX_BYTES,
  OWNER_IMPORT_PAGE_SIZE,
  ownerIssueKey,
  ownerRowCodeKey,
  ownerTemplateCsv,
} from '@/lib/owner-onboarding';
import { useImportOwners } from '@/queries/use-owner-onboarding';
import type { OwnerImportResult, OwnerImportRow } from '@/types/owner-onboarding.types';
import { OwnerManualForm } from './owner-manual-form';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

const ACCEPT = ['.csv', '.xlsx', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] as const;

type FileProblem = 'type' | 'size';

/** What the import would do with the owner and with the ownership of a row, in words; an action this version does not know is left out. */
function RowEffect({ row }: { row: OwnerImportRow }) {
  const { t } = useTranslation();
  const owner = row.ownerAction ? `ownerOnboarding.import.ownerActions.${row.ownerAction}` : null;
  const ownership = row.ownershipAction ? `ownerOnboarding.import.ownershipActions.${row.ownershipAction}` : null;
  const known = new Set(['create_owner', 'match_owner', 'conflict', 'create_ownership', 'update_future_period', 'unchanged']);
  const parts = [row.ownerAction && known.has(row.ownerAction) ? owner : null, row.ownershipAction && known.has(row.ownershipAction) ? ownership : null].filter(
    (key): key is string => key !== null,
  );
  if (parts.length === 0) return <span className="text-foreground/70">-</span>;
  // How an owner already in the registry was found (never by e-mail): the proposed match, said before anything is written.
  const matched = row.matchedBy && ['owner_id', 'external_key', 'fiscal_identifier'].includes(row.matchedBy) ? t(`ownerOnboarding.import.matchedBy.${row.matchedBy}`) : null;
  return (
    <span className="break-words">
      {parts.map((key) => t(key)).join(' · ')}
      {matched ? ` (${matched})` : ''}
    </span>
  );
}

/** The outcome of one row: ok, or each error with the column it is about, in words; never a bare code. */
function RowStatus({ row }: { row: OwnerImportRow }) {
  const { t } = useTranslation();
  if (row.status === 'ok' && row.errors.length === 0) {
    return <span className="font-medium">{row.applied ? t('ownerOnboarding.import.rowApplied') : t('ownerOnboarding.import.rowOk')}</span>;
  }
  const errors = row.errors.length > 0 ? row.errors : [{ column: '', code: row.status }];
  return (
    <ul role="list" className="space-y-1">
      {errors.map((error, index) => {
        const key = ownerRowCodeKey(error.code);
        return (
          <li key={`${error.column}-${error.code}-${index}`} className="break-words">
            {key ? t(key) : t('ownerOnboarding.rowCodes.unknown')}
            {error.column ? ` (${error.column})` : ''}
          </li>
        );
      })}
      {row.candidates.length > 0 ? (
        <li className="break-words text-foreground/70">
          {t('ownerOnboarding.import.candidates', { owners: row.candidates.map((candidate) => `${candidate.displayName} [${candidate.ownerId}]`).join('; ') })}
        </li>
      ) : null}
    </ul>
  );
}

interface ResultViewProps {
  result: OwnerImportResult;
  page: number;
  onPage: (page: number) => void;
}

/** The result of a check or of an import: the counts, one row of the answer for each row of the file, paged. It never shows a value of the file. */
function ResultView({ result, page, onPage }: ResultViewProps) {
  const { t } = useTranslation();
  const { summary } = result;
  const pages = Math.max(1, Math.ceil(result.rows.length / OWNER_IMPORT_PAGE_SIZE));
  const shown = result.rows.slice(page * OWNER_IMPORT_PAGE_SIZE, (page + 1) * OWNER_IMPORT_PAGE_SIZE);
  const refOf = new Map(result.rows.filter((row) => row.propertyId).map((row) => [row.propertyId as string, row.propertyRef ?? ''] as const));

  return (
    <div className="space-y-3" data-testid="owner-import-result" data-dry-run={result.dryRun ? 'true' : 'false'}>
      <p className="text-sm font-medium" role="status" data-testid="owner-import-summary">
        {result.dryRun
          ? t('ownerOnboarding.import.checkSummary', { valid: summary.valid, invalid: summary.invalid })
          : t('ownerOnboarding.import.applySummary', { applied: summary.applied, invalid: summary.invalid })}
      </p>
      {result.dryRun && summary.valid > 0 ? (
        <p className="text-sm text-foreground/70" data-testid="owner-import-effect">
          {t('ownerOnboarding.import.effect', {
            owners: summary.ownersToCreate,
            matched: summary.ownersMatched,
            ownerships: summary.ownershipsToCreate,
            periods: summary.periodsToUpdate,
          })}
        </p>
      ) : null}
      {!result.dryRun && summary.applied === 0 ? (
        <Alert variant="warning" data-testid="owner-import-nothing">
          {t('ownerOnboarding.import.nothingApplied')}
        </Alert>
      ) : null}
      {result.unknownColumns.length > 0 ? (
        <Alert variant="info" data-testid="owner-import-unknown-columns">
          {t('ownerOnboarding.import.unknownColumns', { columns: result.unknownColumns.join(', ') })}
        </Alert>
      ) : null}
      {result.propertyIssues.length > 0 ? (
        <Alert variant="warning" title={t('ownerOnboarding.import.sharesTitle')} data-testid="owner-import-issues">
          <ul role="list" className="list-disc space-y-1 pl-5">
            {result.propertyIssues.map((item) => (
              <li key={item.propertyId} className="break-words">
                {refOf.get(item.propertyId) || t('ownerOnboarding.table.aProperty')}: {item.issues.map((issue) => t(ownerIssueKey(issue.kind), { total: issue.totalPercent })).join(' · ')}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm" data-testid="owner-import-rows">
          <caption className="sr-only">{t('ownerOnboarding.import.rowsCaption')}</caption>
          <thead>
            <tr className="border-b text-foreground/70">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t('ownerOnboarding.import.columns.row')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('ownerOnboarding.import.columns.property')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('ownerOnboarding.import.columns.result')}
              </th>
              <th scope="col" className="py-2 pl-3 font-medium">
                {t('ownerOnboarding.import.columns.effect')}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.rowNumber} className="border-b align-top" data-testid="owner-import-row" data-status={row.status}>
                <th scope="row" className="py-2 pr-3 font-medium">
                  {row.rowNumber}
                </th>
                <td className="break-words px-3 py-2">{row.propertyRef ?? '-'}</td>
                <td className="px-3 py-2">
                  <RowStatus row={row} />
                </td>
                <td className="py-2 pl-3">
                  <RowEffect row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('ownerOnboarding.import.pagesLabel')}>
          <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={page === 0} onClick={() => onPage(page - 1)}>
            {t('ownerOnboarding.import.previousPage')}
          </Button>
          <span className="text-sm" aria-live="polite">
            {t('ownerOnboarding.import.pageOf', { page: page + 1, pages })}
          </span>
          <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
            {t('ownerOnboarding.import.nextPage')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The import of the owners of an agency from a `.csv` or an `.xlsx` (E10/F03/US05/T01, NF-109, AC-NF109-1): a template to download (the header only, built in the
 * browser), the file, the check of every row with its errors and the proposed action before anything changes, and a separate, confirmed import of the valid rows. The
 * file is read only by the server (the page never parses it and never shows its content); the file, the answer and a refusal are not kept by the cache of the
 * mutations (`useImportOwners`), and the panel forgets them when the person chooses another file. It says in so many words that importing sends no invitation:
 * the invitations are another act, with its own preview and confirmation.
 */
export function OwnerImportPanel() {
  const { t } = useTranslation();
  const check = useImportOwners();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<FileProblem | null>(null);
  const [checkedFile, setCheckedFile] = useState<File | null>(null);
  const [page, setPage] = useState(0);
  const [confirming, setConfirming] = useState(false);
  // The form of one owner entered by hand: shown on request, and emptied (a new key) when the file is forgotten or the import wrote something.
  const [manualOpen, setManualOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const { mutate, reset, isPending, error } = check;
  const result = check.data;
  // Only the check of THIS file opens the import: another file, or a file that was changed, is checked again.
  const canImport = file !== null && checkedFile === file && result?.dryRun === true && result.summary.valid > 0 && !isPending;
  const errorMessage = useMemo(() => (error ? (getProblemMessage(error, t) ?? t('ownerOnboarding.import.error')) : null), [error, t]);

  function choose(files: File[]) {
    const chosen = files[0];
    if (!chosen) return;
    reset();
    setCheckedFile(null);
    setPage(0);
    if (!isOwnerImportFileName(chosen.name)) {
      setFile(null);
      setProblem('type');
      return;
    }
    if (chosen.size > OWNER_IMPORT_MAX_BYTES) {
      setFile(null);
      setProblem('size');
      return;
    }
    setProblem(null);
    setFile(chosen);
  }

  function checkFile() {
    if (!file) return;
    const sent = file;
    setPage(0);
    mutate({ file: sent, dryRun: true }, { onSuccess: () => setCheckedFile(sent) });
  }

  /** The row typed by hand, as a file: checked exactly as a file chosen from the computer is. */
  function checkManual(manual: File) {
    reset();
    setProblem(null);
    setPage(0);
    setFile(manual);
    setCheckedFile(null);
    mutate({ file: manual, dryRun: true }, { onSuccess: () => setCheckedFile(manual) });
  }

  function importFile() {
    if (!file || !canImport) return;
    setPage(0);
    mutate(
      { file, dryRun: false },
      {
        onSuccess: (done) => {
          if (done.summary.applied > 0) setFormKey((key) => key + 1);
        },
        onSettled: () => setConfirming(false),
      },
    );
  }

  function forget() {
    reset();
    setFormKey((key) => key + 1);
    setFile(null);
    setCheckedFile(null);
    setProblem(null);
    setPage(0);
  }

  return (
    <div className="min-w-0 space-y-4" data-testid="owner-import-panel">
      <Alert variant="info" data-testid="owner-import-sends-nothing">
        {t('ownerOnboarding.import.sendsNothing')}
      </Alert>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className={TOUCH_TARGET}
          onClick={() => saveBlobAs(new Blob([ownerTemplateCsv()], { type: 'text/csv;charset=utf-8' }), 'modello-proprietari.csv')}
          data-testid="owner-import-template"
        >
          <Download aria-hidden="true" className="size-4" />
          {t('ownerOnboarding.import.template')}
        </Button>
        <p className="text-sm text-foreground/70">{t('ownerOnboarding.import.limits')}</p>
      </div>

      <Dropzone
        accept={ACCEPT}
        multiple={false}
        onFiles={choose}
        disabled={isPending}
        title={file ? t('ownerOnboarding.import.chosen', { name: file.name }) : t('ownerOnboarding.import.drop')}
        buttonLabel={t(file ? 'ownerOnboarding.import.chooseAnother' : 'ownerOnboarding.import.choose')}
        hint={t('ownerOnboarding.import.hint')}
        data-testid="owner-import-dropzone"
      />

      <div className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          className={TOUCH_TARGET}
          aria-expanded={manualOpen}
          aria-controls="owner-manual-region"
          onClick={() => setManualOpen((open) => !open)}
          data-testid="owner-import-manual-toggle"
        >
          {t(manualOpen ? 'ownerOnboarding.manual.close' : 'ownerOnboarding.manual.open')}
        </Button>
        <div id="owner-manual-region" hidden={!manualOpen}>
          {manualOpen ? <OwnerManualForm key={formKey} disabled={isPending} onFile={checkManual} /> : null}
        </div>
      </div>

      {problem ? (
        <Alert variant="danger" data-testid="owner-import-file-problem">
          {t(problem === 'type' ? 'ownerOnboarding.import.fileType' : 'ownerOnboarding.import.fileSize')}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className={TOUCH_TARGET} disabled={!file || isPending} loading={isPending && check.variables?.dryRun === true} onClick={checkFile} data-testid="owner-import-check">
          {t('ownerOnboarding.import.check')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={TOUCH_TARGET}
          disabled={!canImport}
          onClick={() => setConfirming(true)}
          data-testid="owner-import-apply"
          aria-describedby={canImport ? undefined : 'owner-import-apply-note'}
        >
          {t('ownerOnboarding.import.apply')}
        </Button>
        {file ? (
          <Button type="button" variant="ghost" className={TOUCH_TARGET} disabled={isPending} onClick={forget} data-testid="owner-import-forget">
            {t('ownerOnboarding.import.forget')}
          </Button>
        ) : null}
      </div>
      {!canImport ? (
        <p id="owner-import-apply-note" className="text-sm text-foreground/70">
          {t('ownerOnboarding.import.applyNeedsCheck')}
        </p>
      ) : null}

      {errorMessage ? (
        <Alert variant="danger" data-testid="owner-import-error" role="alert">
          {errorMessage}
        </Alert>
      ) : null}

      {result ? <ResultView result={result} page={page} onPage={setPage} /> : null}

      <ConfirmationDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!isPending) setConfirming(open);
        }}
        title={t('ownerOnboarding.import.confirm.title', { count: result?.summary.valid ?? 0 })}
        description={t('ownerOnboarding.import.confirm.description')}
        consequences={[
          t('ownerOnboarding.import.confirm.valid', { count: result?.summary.valid ?? 0 }),
          t('ownerOnboarding.import.confirm.invalid', { count: result?.summary.invalid ?? 0 }),
          t('ownerOnboarding.import.confirm.noInvitation'),
        ]}
        confirmLabel={t('ownerOnboarding.import.confirm.action')}
        cancelLabel={t('ownerOnboarding.import.confirm.cancel')}
        isLoading={isPending}
        onConfirm={importFile}
      />
    </div>
  );
}

