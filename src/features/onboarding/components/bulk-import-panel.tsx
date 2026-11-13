import { useId, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle2, Download, Equal, FileSpreadsheet, type LucideIcon } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_TEMPLATE_FILE_NAME,
  importColumnKey,
  importErrorKey,
  importTemplateCsv,
  isAcceptedImportFile,
  pageOf,
} from '@/lib/onboarding-bulk';
import type { StatusTone } from '@/lib/status-dictionary';
import { useImportProperties } from '@/queries/use-onboarding-bulk';
import type { ImportResult, ImportRowResult } from '@/types/onboarding.types';
import { ClientPager } from './client-pager';
import { StatePill } from './state-pill';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** What the page holds of the file after a call: the check (of THAT file), the import (the file is let go of), or a call that failed after it may have written. */
type Stage = { kind: 'checked'; file: File; result: ImportResult } | { kind: 'imported'; result: ImportResult } | { kind: 'uncertain' };

/** A count the server sent as a number; anything else is 0. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** The size of the file in megabytes, to one decimal, for the line under its name. */
function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** How a row stands: right or to correct in a check, and in an import whether it changed something. A row with an error is never shown as right. */
function rowView(row: ImportRowResult, imported: boolean): { tone: StatusTone; Icon: LucideIcon; key: string } {
  const right = row.status === 'ok' && (!Array.isArray(row.errors) || row.errors.length === 0);
  if (!right) return { tone: 'danger', Icon: Ban, key: imported ? 'notImported' : 'toFix' };
  if (!imported) return { tone: 'success', Icon: CheckCircle2, key: 'ok' };
  return row.applied ? { tone: 'success', Icon: CheckCircle2, key: 'imported' } : { tone: 'neutral', Icon: Equal, key: 'nothingChanged' };
}

/**
 * ONE row for each row of the file, a page of 50 at a time: its number, what it names the property by, how it stands and, for an error, the column and the
 * reason in plain words. The lock code never comes back from the server and is never in the page: a row says only whether it had one.
 */
function RowsTable({ rows, imported }: { rows: readonly ImportRowResult[]; imported: boolean }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const shown = pageOf(rows, page);

  return (
    <div className="space-y-2" data-testid="bulk-import-rows">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">{t('onboardingPlan.bulk.import.rowsCaption')}</caption>
          <thead>
            <tr className="border-b text-foreground/70">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t('onboardingPlan.bulk.import.row')}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('onboardingPlan.bulk.import.property')}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('onboardingPlan.bulk.import.status')}
              </th>
              <th scope="col" className="py-2 pl-2 font-medium">
                {t('onboardingPlan.bulk.import.lockCode')}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.rows.map((row) => {
              const view = rowView(row, imported);
              const errors = Array.isArray(row.errors) ? row.errors : [];
              return (
                <tr key={row.rowNumber} className="border-b align-top last:border-b-0" data-testid={`bulk-import-row-${row.rowNumber}`} data-status={view.key}>
                  <td className="py-2 pr-3 tabular-nums">{row.rowNumber}</td>
                  <td className="min-w-0 break-words px-2 py-2">{row.propertyRef ?? t('onboardingPlan.bulk.import.noProperty')}</td>
                  <td className="min-w-0 px-2 py-2">
                    <StatePill tone={view.tone} icon={view.Icon} label={t(`onboardingPlan.bulk.import.rowStatus.${view.key}`)} />
                    {errors.length > 0 ? (
                      <ul role="list" className="mt-1 space-y-0.5" data-testid={`bulk-import-row-${row.rowNumber}-errors`}>
                        {errors.map((error) => (
                          <li key={`${error.column}-${error.code}`} className="break-words">
                            {t('onboardingPlan.bulk.import.errorLine', { column: t(importColumnKey(error.column)), reason: t(importErrorKey(error.code)) })}
                          </li>
                        ))}
                      </ul>
                    ) : row.status !== 'ok' ? (
                      <p className="mt-1 break-words">{t(importErrorKey(row.status))}</p>
                    ) : null}
                  </td>
                  <td className="py-2 pl-2" data-testid={`bulk-import-row-${row.rowNumber}-lock`}>
                    {row.lockCodeProvided === true ? t('onboardingPlan.bulk.import.lockProvided') : t('onboardingPlan.bulk.import.lockNotProvided')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ClientPager page={shown.page} pages={shown.pages} total={rows.length} onPage={setPage} testId="bulk-import-pager" />
    </div>
  );
}

/**
 * Fills the data that changes from one property to the next from a file (E10/F03/US03/T02, NF-105, AC-NF105-2): comune and region, the Alloggiati room numbers
 * and the lock code, for a few hundred properties without a wizard for each. The limits and the columns are said before the person chooses; «Scarica il modello»
 * builds a CSV with the header only, in the browser.
 *
 * - The file is read ONLY by the server: the page never opens it, never parses it and never shows its content (only its name and its size). It is sent as it is,
 *   in the body, and the address carries only `dryRun`. The lock code is therefore never rendered, never in the state of the page and never in an address: a row of
 *   the answer says only whether the file had one.
 * - «Controlla il file» (`dryRun=true`, nothing written) shows ONE row for each row of the file, a page of 50 at a time, with `ok` or its errors in plain words with
 *   the column, and «N righe giuste, M da correggere».
 * - «Importa le righe giuste» is on only after a check of THE SAME file (another file, another check), opens a confirmation, and sends the file once (`dryRun=false`:
 *   only the valid rows are written, an invalid row never blocks a valid one). Once imported the page lets go of the file, so the same file is not sent twice.
 * - A call that fails after it may have written says so and asks to check again; it is never told as done. Every button is off while a request is on its way.
 */
export function BulkImportPanel() {
  const { t } = useTranslation();
  const ids = useId();
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const run = useImportProperties();
  const [file, setFile] = useState<File | null>(null);
  const [rejected, setRejected] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [confirming, setConfirming] = useState(false);

  // A check counts only for the file it was made on.
  const checked = stage?.kind === 'checked' && stage.file === file ? stage.result : null;
  const imported = stage?.kind === 'imported' ? stage.result : null;
  const shownResult = checked ?? imported;
  const valid = checked ? count(checked.summary?.valid) : 0;
  const invalid = shownResult ? count(shownResult.summary?.invalid) : 0;
  const busy = run.isPending;
  const rows = shownResult && Array.isArray(shownResult.rows) ? shownResult.rows : [];

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    // So that the same file can be chosen again (after it was corrected): the input forgets it, the page keeps only the handle.
    event.target.value = '';
    if (!picked) return;
    run.reset();
    setStage(null);
    if (isAcceptedImportFile(picked)) {
      setRejected(false);
      setFile(picked);
    } else {
      setRejected(true);
      setFile(null);
    }
  }

  function checkFile() {
    if (!file) return;
    const asked = file;
    run.mutate({ file: asked, dryRun: true }, { onSuccess: (result) => setStage({ kind: 'checked', file: asked, result }), onError: () => setStage(null) });
  }

  async function importNow() {
    // The file is sent once: a second press while it is on its way (or before the page has drawn that it is) does nothing.
    if (inFlight.current || !file || !checked || valid === 0) return;
    inFlight.current = true;
    try {
      const result = await run.mutateAsync({ file, dryRun: false });
      // An answer that says nothing was written is not an import: it is told as not done.
      setStage(result.dryRun ? { kind: 'uncertain' } : { kind: 'imported', result });
      // Imported: the page lets go of the file (it may hold lock codes), so that it cannot be sent again from here.
      if (!result.dryRun) setFile(null);
    } catch {
      setStage({ kind: 'uncertain' });
    } finally {
      inFlight.current = false;
      setConfirming(false);
    }
  }

  function downloadTemplate() {
    saveBlobAs(new Blob([importTemplateCsv()], { type: 'text/csv;charset=utf-8' }), IMPORT_TEMPLATE_FILE_NAME);
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="min-w-0 space-y-4 rounded-lg border bg-card p-4" data-testid="bulk-import">
      <div className="space-y-1">
        <h2 id={`${ids}-title`} className="text-lg font-semibold">
          {t('onboardingPlan.bulk.import.title')}
        </h2>
        <p className="text-sm text-foreground/70">{t('onboardingPlan.bulk.import.description')}</p>
      </div>

      <div className="space-y-1 text-sm" data-testid="bulk-import-limits">
        <p>{t('onboardingPlan.bulk.import.limits', { size: megabytes(IMPORT_MAX_BYTES), rows: IMPORT_MAX_ROWS })}</p>
        <p>
          {t('onboardingPlan.bulk.import.columnsIntro')}{' '}
          {IMPORT_COLUMNS.map((column) => t(importColumnKey(column))).join(', ')}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={choose}
          data-testid="bulk-import-input"
        />
        <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={busy} onClick={() => input.current?.click()} iconRight={<FileSpreadsheet />} data-testid="bulk-import-choose">
          {t('onboardingPlan.bulk.import.choose')}
        </Button>
        <Button type="button" variant="ghost" className={TOUCH_TARGET} disabled={busy} onClick={downloadTemplate} iconRight={<Download />} data-testid="bulk-import-template">
          {t('onboardingPlan.bulk.import.template')}
        </Button>
      </div>

      {rejected ? (
        <p role="alert" className="text-sm text-danger-foreground" data-testid="bulk-import-rejected">
          {t('onboardingPlan.bulk.import.rejected', { size: megabytes(IMPORT_MAX_BYTES) })}
        </p>
      ) : null}
      {file ? (
        <p className="break-words text-sm" data-testid="bulk-import-file">
          {t('onboardingPlan.bulk.import.chosen', { name: file.name, size: megabytes(file.size) })}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" className={TOUCH_TARGET} disabled={!file || busy} loading={run.isPending && !confirming} onClick={checkFile} data-testid="bulk-import-check">
          {t('onboardingPlan.bulk.import.check')}
        </Button>
        <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={!checked || valid === 0 || busy} onClick={() => setConfirming(true)} data-testid="bulk-import-apply">
          {t('onboardingPlan.bulk.import.apply')}
        </Button>
      </div>
      {file && !checked ? (
        <p className="text-sm text-foreground/70" data-testid="bulk-import-check-first">
          {t('onboardingPlan.bulk.import.checkFirst')}
        </p>
      ) : null}

      {run.isError && stage?.kind !== 'uncertain' ? (
        <p role="alert" className="text-sm text-danger-foreground" data-testid="bulk-import-error">
          {getProblemMessage(run.error, t) ?? t('onboardingPlan.bulk.import.error')}
        </p>
      ) : null}

      {stage?.kind === 'uncertain' ? (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-soft p-3 text-sm text-danger-foreground" data-testid="bulk-import-uncertain">
          {t('onboardingPlan.bulk.import.uncertain')}
        </p>
      ) : null}

      {shownResult ? (
        <div className="space-y-3" aria-live="polite" data-testid={imported ? 'bulk-import-imported' : 'bulk-import-checked'}>
          <p className="font-medium" data-testid="bulk-import-summary">
            {imported
              ? t('onboardingPlan.bulk.import.importedSummary', { count: count(imported.summary?.applied) })
              : `${t('onboardingPlan.bulk.import.summary.valid', { count: valid })}, ${t('onboardingPlan.bulk.import.summary.invalid', { count: invalid })}`}
          </p>
          {imported && invalid > 0 ? (
            <p role="alert" className="text-sm text-warning-foreground" data-testid="bulk-import-left-out">
              {t('onboardingPlan.bulk.import.leftOut', { count: invalid })}
            </p>
          ) : null}
          {count(shownResult.unknownColumns?.length) > 0 ? (
            <p className="text-sm text-foreground/70" data-testid="bulk-import-unknown-columns">
              {t('onboardingPlan.bulk.import.unknownColumns', { count: count(shownResult.unknownColumns.length) })}
            </p>
          ) : null}
          <RowsTable key={imported ? 'imported' : 'checked'} rows={rows} imported={imported !== null} />
        </div>
      ) : null}

      <ConfirmationDialog
        open={confirming}
        onOpenChange={(open) => {
          // A press on «Annulla», on the outside or a focus that leaves the dialog while the file is on its way does not drop it (the ref, not the state: the
          // handler may be the one of the render before the call started): the dialog closes when the answer is in.
          if (!inFlight.current) setConfirming(open);
        }}
        title={t('onboardingPlan.bulk.import.confirmTitle', { count: valid })}
        description={t('onboardingPlan.bulk.import.confirmDescription')}
        confirmLabel={t('onboardingPlan.bulk.import.confirmAction', { count: valid })}
        isLoading={run.isPending}
        onConfirm={importNow}
        consequences={[t('onboardingPlan.bulk.import.confirmValid', { count: valid }), t('onboardingPlan.bulk.import.confirmInvalid', { count: invalid })]}
      />
    </section>
  );
}
