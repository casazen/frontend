import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dropzone } from '@/components/ui/dropzone';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { getProblemMessage } from '@/lib/api-errors';
import { holdForUndo, useHeldKeys } from '@/lib/hold-for-undo';
import { cn, formatCurrency } from '@/lib/utils';
import { useRentRegisterActions } from '@/queries/use-rent-register';
import type { BankColumnMapping, BankColumnsProblem, BankImportCredit, BankImportInstallment, BankImportPreview } from '@/types';
import {
  BANK_IMPORT_KEY,
  STATEMENT_ACCEPT,
  chosenElsewhere,
  columnsProblemOf,
  initialMappingChoice,
  initialRows,
  mappingOf,
  optionsOf,
  selectionsOf,
  splitRows,
  statementFileProblem,
  withInstallment,
  type MappingChoice,
  type ReviewRow,
} from '../lib/bank-import';
import { fullDay, monthName, monthOfDate, shortDay } from '../lib/rent-register';

/** Where the dialog is: it asks for the file, reads it, asks which column is which, or shows what it found. */
type Stage =
  | { name: 'choose' }
  | { name: 'reading' }
  | { name: 'columns'; problem: BankColumnsProblem }
  | { name: 'review'; preview: BankImportPreview };

interface BankStatementImportDialogProps {
  onClose: () => void;
}

/** The columns of the first rows the landlord sees when the columns are not recognized (the server sends no more than twelve). */
const PREVIEW_COLUMNS = 12;

/** What the landlord answered to a table whose columns were not recognized: the mapping, and the problem it answers (to come back to it). */
interface ColumnsAnswer {
  mapping: BankColumnMapping;
  problem: BankColumnsProblem;
}

/**
 * Import of a bank statement on the rents («Importa estratto conto», page Canoni). The landlord gives the file their bank exports, the
 * server proposes for each credit the installment it pays, and the landlord confirms: what is sure is already ticked and one click
 * confirms it, what is doubtful waits to be ticked or to have its installment chosen, and nothing is marked paid without the landlord
 * pressing «Conferma». The file is read and not kept: the confirmation sends it again. Declaring paid cannot be taken back, so the
 * confirmation waits six seconds with an «Annulla» that is true (`holdForUndo`: nothing is recorded until they pass).
 */
export function BankStatementImportDialog({ onClose }: BankStatementImportDialogProps) {
  const { t, i18n } = useTranslation();
  const actions = useRentRegisterActions();

  const [stage, setStage] = useState<Stage>({ name: 'choose' });
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<BankColumnMapping | undefined>(undefined);
  const [choice, setChoice] = useState<MappingChoice>({ hasTitles: false, date: '', description: '', amount: '' });
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The previous import is still in its six seconds (or being recorded): another one cannot start until it has gone.
  const waiting = useHeldKeys().has(BANK_IMPORT_KEY);

  async function read(next: File, answer?: ColumnsAnswer) {
    const refusal = statementFileProblem(next);
    if (refusal) {
      setError(t(`longRentRents.bankImport.choose.${refusal}`));
      setStage({ name: 'choose' });
      return;
    }

    setFile(next);
    setError(null);
    setStage({ name: 'reading' });
    try {
      const preview = await actions.previewBankStatement(next, answer?.mapping);
      setMapping(answer?.mapping);
      setRows(initialRows(preview));
      setStage({ name: 'review', preview });
    } catch (cause) {
      // A table whose titles the importer does not know: the landlord says which column is which, once.
      const problem = answer ? null : columnsProblemOf(cause);
      if (problem) {
        setChoice(initialMappingChoice(problem));
        setStage({ name: 'columns', problem });
        return;
      }
      setError(getProblemMessage(cause, t) ?? t('longRentRents.bankImport.choose.readFailed'));
      // A mapping the file did not accept brings the landlord back to their columns, not to the start: they change one, not all.
      setStage(answer ? { name: 'columns', problem: answer.problem } : { name: 'choose' });
    }
  }

  function confirm() {
    const chosen = selectionsOf(rows);
    if (!file || chosen.length === 0 || waiting) return;
    const statement = file;
    const columns = mapping;
    const started = holdForUndo({
      key: BANK_IMPORT_KEY,
      message: t('longRentRents.bankImport.held', { count: chosen.length }),
      description: t('longRentRents.bankImport.heldHint'),
      commit: async () => {
        const result = await actions.confirmBankStatement(statement, chosen, columns);
        if (result.confirmed.length > 0) toast.success(t('longRentRents.bankImport.done', { count: result.confirmed.length }));
        else toast.info(t('longRentRents.bankImport.nothingDone'));
        if (result.skipped.length > 0) toast.info(t('longRentRents.bankImport.skipped', { count: result.skipped.length }));
      },
    });
    // Taken meanwhile by another import: the review stays with what the landlord chose, and they are told.
    if (!started) {
      toast.info(t('longRentRents.alreadyHeld'));
      return;
    }
    onClose();
  }

  const selected = selectionsOf(rows).length;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:max-w-2xl sm:overflow-y-auto" data-testid="bank-import-dialog" data-stage={stage.name}>
        <DialogHeader>
          <DialogTitle>{t('longRentRents.bankImport.title')}</DialogTitle>
          <DialogDescription className="break-words">
            {stage.name === 'columns'
              ? t('longRentRents.bankImport.columns.intro')
              : stage.name === 'review'
                ? t('longRentRents.bankImport.review.description')
                : t('longRentRents.bankImport.choose.description')}
          </DialogDescription>
        </DialogHeader>

        {stage.name === 'choose' || stage.name === 'reading' ? (
          <div className="space-y-3">
            {error ? <Alert variant="danger" data-testid="bank-import-error">{error}</Alert> : null}
            <Dropzone
              accept={STATEMENT_ACCEPT}
              multiple={false}
              disabled={stage.name === 'reading'}
              onFiles={(files) => void read(files[0])}
              title={stage.name === 'reading' ? t('longRentRents.bankImport.choose.reading') : t('longRentRents.bankImport.choose.dropTitle')}
              buttonLabel={t('longRentRents.bankImport.choose.button')}
              hint={t('longRentRents.bankImport.choose.hint')}
              data-testid="bank-import-dropzone"
            />
          </div>
        ) : null}

        {stage.name === 'columns' ? (
          <ColumnsStep
            problem={stage.problem}
            choice={choice}
            error={error}
            onChoice={setChoice}
            onBack={() => {
              setError(null);
              setStage({ name: 'choose' });
            }}
            onContinue={(columns) => file && void read(file, { mapping: columns, problem: stage.problem })}
          />
        ) : null}

        {stage.name === 'review' ? (
          <ReviewStep
            preview={stage.preview}
            rows={rows}
            onRows={setRows}
            language={i18n.language}
            selected={selected}
            waiting={waiting}
            onBack={() => {
              setRows([]);
              setStage({ name: 'choose' });
            }}
            onConfirm={confirm}
            onCancel={onClose}
          />
        ) : null}

        {stage.name !== 'review' && stage.name !== 'columns' ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('longRentRents.cancel')}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- which column is which

interface ColumnsStepProps {
  problem: BankColumnsProblem;
  choice: MappingChoice;
  /** Why the file could not be read with the last choice, if it could not. */
  error: string | null;
  onChoice: (choice: MappingChoice) => void;
  onBack: () => void;
  onContinue: (mapping: BankColumnMapping) => void;
}

/**
 * The importer did not recognize the titles of the table: the first rows are shown as they are and the landlord says which column holds
 * the date, the description and the amount. Each column has one role.
 */
function ColumnsStep({ problem, choice, error, onChoice, onBack, onContinue }: ColumnsStepProps) {
  const { t } = useTranslation();
  const shown = Math.min(Math.max(problem.columnCount, 1), PREVIEW_COLUMNS);
  const mapping = mappingOf(problem, choice);
  const chosen = [choice.date, choice.description, choice.amount].filter((value) => value !== '');
  const clash = new Set(chosen).size < chosen.length;

  // A column is named by its title when the first row is one, and by its number otherwise; the first movement says what is in it.
  const headerIndex = choice.hasTitles ? Math.max(problem.headerRow, 0) : -1;
  const titles = headerIndex >= 0 ? problem.rows[headerIndex] : undefined;
  const firstMovement = problem.rows[headerIndex + 1] ?? [];
  const columnName = (index: number) => {
    const title = titles?.[index]?.trim();
    const name = title ? title : t('longRentRents.bankImport.columns.column', { number: index + 1 });
    const sample = firstMovement[index]?.trim();
    return sample ? t('longRentRents.bankImport.columns.option', { name, sample }) : name;
  };
  const choices = Array.from({ length: shown }, (_, index) => index);
  const fields: { role: 'date' | 'description' | 'amount'; label: string; hint?: string }[] = [
    { role: 'date', label: t('longRentRents.bankImport.columns.fields.date') },
    { role: 'description', label: t('longRentRents.bankImport.columns.fields.description') },
    { role: 'amount', label: t('longRentRents.bankImport.columns.fields.amount'), hint: t('longRentRents.bankImport.columns.amountHint') },
  ];

  return (
    // min-w-0: as a child of the dialog's grid the step would take the width of the table, which scrolls on its own.
    <div className="min-w-0 space-y-4" data-testid="bank-import-columns">
      {error ? <Alert variant="danger" data-testid="bank-import-error">{error}</Alert> : null}
      <div className="overflow-x-auto rounded-md border" role="region" aria-label={t('longRentRents.bankImport.columns.tableLabel')} tabIndex={0}>
        <table className="w-full text-left text-xs">
          <tbody>
            {problem.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={cn('border-b last:border-b-0', rowIndex === headerIndex && 'bg-muted font-medium')}>
                {choices.map((index) => (
                  <td key={index} className="max-w-40 truncate px-2 py-1.5">
                    {row[index] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={choice.hasTitles} onCheckedChange={(checked) => onChoice({ ...choice, hasTitles: checked === true })} />
        {t('longRentRents.bankImport.columns.hasTitles')}
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <Field key={field.role} label={field.label} hint={field.hint}>
            <Select
              value={choice[field.role]}
              onChange={(event) => onChoice({ ...choice, [field.role]: event.target.value })}
              data-testid={`bank-import-column-${field.role}`}
            >
              <option value="">{t('longRentRents.bankImport.columns.placeholder')}</option>
              {choices.map((index) => (
                <option key={index} value={String(index)}>
                  {columnName(index)}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>
      {clash ? <p className="text-sm text-foreground/70">{t('longRentRents.bankImport.columns.same')}</p> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          {t('longRentRents.bankImport.columns.back')}
        </Button>
        <Button type="button" disabled={mapping === null} onClick={() => mapping && onContinue(mapping)} data-testid="bank-import-columns-continue">
          {t('longRentRents.bankImport.columns.continue')}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ---------------------------------------------------------------- what was found

interface ReviewStepProps {
  preview: BankImportPreview;
  rows: ReviewRow[];
  onRows: (rows: ReviewRow[]) => void;
  language: string;
  selected: number;
  /** The previous import is still being recorded: this one waits for it. */
  waiting: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * What the file says about the rents. The one thing on the screen is the list of the credits that are sure, already ticked, and one
 * button under it; what is doubtful and what matched nothing is one click away and folded.
 */
function ReviewStep({ preview, rows, onRows, language, selected, waiting, onBack, onConfirm, onCancel }: ReviewStepProps) {
  const { t } = useTranslation();
  const { sure, toCheck } = splitRows(rows);
  const { summary } = preview;
  const [checkOpen, setCheckOpen] = useState(sure.length === 0);
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);

  const update = (suggestionFingerprint: string, change: (row: ReviewRow) => ReviewRow) =>
    onRows(rows.map((row) => (row.suggestion.fingerprint === suggestionFingerprint ? change(row) : row)));

  return (
    <div className="min-w-0 space-y-4" data-testid="bank-import-review">
      <div className="space-y-1 text-sm" data-testid="bank-import-summary">
        <p className="font-medium">{t('longRentRents.bankImport.review.found', { count: summary.credits })}</p>
        {summary.alreadyImported > 0 ? (
          <p className="text-foreground/70">{t('longRentRents.bankImport.review.alreadyImported', { count: summary.alreadyImported })}</p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Alert variant="info" title={t('longRentRents.bankImport.review.noneTitle')} data-testid="bank-import-none">
          {t('longRentRents.bankImport.review.noneHint')}
        </Alert>
      ) : null}

      {sure.length > 0 ? (
        <section className="space-y-2" aria-labelledby="bank-import-sure-title" data-testid="bank-import-sure">
          <div>
            <h3 id="bank-import-sure-title" className="text-base font-semibold">
              {t('longRentRents.bankImport.review.sure.title', { count: sure.length })}
            </h3>
            <p className="text-sm text-foreground/70">{t('longRentRents.bankImport.review.sure.hint')}</p>
          </div>
          <ul className="divide-y rounded-lg border">
            {sure.map((row) => (
              <SureRow
                key={row.suggestion.fingerprint}
                row={row}
                elsewhere={chosenElsewhere(rows, rows.indexOf(row))}
                language={language}
                onChecked={(checked) => update(row.suggestion.fingerprint, (current) => ({ ...current, checked }))}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {toCheck.length > 0 ? (
        <section className="space-y-2" data-testid="bank-import-check">
          <Fold
            open={checkOpen}
            onToggle={() => setCheckOpen(!checkOpen)}
            title={t('longRentRents.bankImport.review.check.title', { count: toCheck.length })}
            testId="bank-import-check-toggle"
          />
          {checkOpen ? (
            <>
              <p className="text-sm text-foreground/70">{t('longRentRents.bankImport.review.check.hint')}</p>
              <ul className="divide-y rounded-lg border">
                {toCheck.map((row) => (
                  <CheckRow
                    key={row.suggestion.fingerprint}
                    row={row}
                    elsewhere={chosenElsewhere(rows, rows.indexOf(row))}
                    language={language}
                    onInstallment={(installmentId) => update(row.suggestion.fingerprint, (current) => withInstallment(current, installmentId))}
                    onChecked={(checked) => update(row.suggestion.fingerprint, (current) => ({ ...current, checked }))}
                  />
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {preview.unmatched.length > 0 ? (
        <section className="space-y-2" data-testid="bank-import-unmatched">
          <Fold
            open={unmatchedOpen}
            onToggle={() => setUnmatchedOpen(!unmatchedOpen)}
            title={t('longRentRents.bankImport.review.unmatched.title', { count: summary.unmatched })}
            testId="bank-import-unmatched-toggle"
          />
          {unmatchedOpen ? (
            <>
              <p className="text-sm text-foreground/70">{t('longRentRents.bankImport.review.unmatched.hint')}</p>
              <ul className="divide-y rounded-lg border text-sm">
                {preview.unmatched.map((credit) => (
                  <UnmatchedRow key={credit.fingerprint} credit={credit} language={language} />
                ))}
              </ul>
              {summary.unmatched > preview.unmatched.length ? (
                <p className="text-sm text-foreground/70">
                  {t('longRentRents.bankImport.review.unmatched.more', { count: summary.unmatched - preview.unmatched.length })}
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      <DialogFooter className="items-center gap-2 sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('longRentRents.bankImport.review.back')}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('longRentRents.cancel')}
          </Button>
          <Button type="button" disabled={selected === 0 || waiting} onClick={onConfirm} data-testid="bank-import-confirm">
            {t('longRentRents.bankImport.review.confirm', { count: selected })}
          </Button>
        </div>
      </DialogFooter>
      <p className="text-xs text-foreground/70" data-testid="bank-import-confirm-note">
        {t(waiting ? 'longRentRents.bankImport.review.waiting' : 'longRentRents.bankImport.review.confirmNote')}
      </p>
    </div>
  );
}

interface FoldProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  testId: string;
}

/** A section that is folded until the landlord opens it: the doubtful and the left over are not what the dialog is about. */
function Fold({ open, onToggle, title, testId }: FoldProps) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      className="flex items-center gap-1 text-base font-semibold hover:underline"
      aria-expanded={open}
      onClick={onToggle}
      data-testid={testId}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {title}
    </button>
  );
}

/** Who owes it and what it pays, in one line: «Giulia Verdi · Bilocale Sparano». */
function installmentTitle(installment: BankImportInstallment, unknownTenant: string): string {
  return `${installment.tenantName ?? unknownTenant} · ${installment.propertyName}`;
}

/** «Canone di ottobre 2026 · scadenza 5 ott». */
function installmentWhat(installment: BankImportInstallment, language: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t('longRentRents.bankImport.review.rentOf', {
    month: monthName(monthOfDate(installment.periodStart), language),
    due: shortDay(installment.dueDate, language),
  });
}

interface SureRowProps {
  row: ReviewRow;
  /** The installments another row has chosen and ticked. */
  elsewhere: ReadonlySet<string>;
  language: string;
  onChecked: (checked: boolean) => void;
}

function SureRow({ row, elsewhere, language, onChecked }: SureRowProps) {
  const { t } = useTranslation();
  const { suggestion } = row;
  const amount = formatCurrency(suggestion.amount, suggestion.currency);
  const reasons = suggestion.reasons.map((reason) => t(`longRentRents.bankImport.reasons.${reason}`)).join(', ');
  const unknownTenant = t('longRentRents.bankImport.review.tenantUnknown');
  // Another credit has taken this rent since the landlord unticked it here: it cannot be ticked again for both.
  const taken = elsewhere.has(row.installmentId);

  return (
    <li data-testid="bank-import-sure-row">
      <label className={cn('flex items-start gap-3 p-3', !taken && 'cursor-pointer')}>
        <Checkbox
          className="mt-1"
          checked={row.checked}
          disabled={taken}
          onCheckedChange={(checked) => onChecked(checked === true)}
          aria-label={t('longRentRents.bankImport.review.tickSure', {
            tenant: suggestion.installment.tenantName ?? unknownTenant,
            property: suggestion.installment.propertyName,
            month: monthName(monthOfDate(suggestion.installment.periodStart), language),
            amount,
          })}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="break-words font-medium">{installmentTitle(suggestion.installment, unknownTenant)}</p>
          <p className="break-words text-sm">{installmentWhat(suggestion.installment, language, t)}</p>
          <p className="break-words text-xs text-foreground/70">
            {t('longRentRents.bankImport.review.credit', { date: fullDay(suggestion.date, language) })} · {t('longRentRents.bankImport.reasons.matched', { reasons })}
            {taken ? ` · ${t('longRentRents.bankImport.review.taken')}` : ''}
          </p>
        </div>
        <p className="whitespace-nowrap font-medium">{amount}</p>
      </label>
    </li>
  );
}

interface CheckRowProps {
  row: ReviewRow;
  /** The installments another row has already chosen. */
  elsewhere: ReadonlySet<string>;
  language: string;
  onInstallment: (installmentId: string) => void;
  onChecked: (checked: boolean) => void;
}

function CheckRow({ row, elsewhere, language, onInstallment, onChecked }: CheckRowProps) {
  const { t } = useTranslation();
  const { suggestion } = row;
  const amount = formatCurrency(suggestion.amount, suggestion.currency);
  const unknownTenant = t('longRentRents.bankImport.review.tenantUnknown');
  const date = fullDay(suggestion.date, language);
  // Nothing to tick until a rent is chosen, and not a rent another credit has already taken.
  const blocked = row.installmentId === '' || elsewhere.has(row.installmentId);

  return (
    <li className="space-y-2 p-3" data-testid="bank-import-check-row">
      <label className={cn('flex items-start gap-3', !blocked && 'cursor-pointer')}>
        <Checkbox
          className="mt-1"
          checked={row.checked}
          disabled={blocked}
          onCheckedChange={(checked) => onChecked(checked === true)}
          aria-label={t('longRentRents.bankImport.review.tickCheck', { date, amount })}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="break-words text-sm font-medium">
            {t('longRentRents.bankImport.review.credit', { date })} · {amount}
          </p>
          {suggestion.payer ? <p className="break-words text-xs text-foreground/70">{suggestion.payer}</p> : null}
          <p className="line-clamp-2 break-words text-xs text-foreground/70">{suggestion.description}</p>
        </div>
      </label>
      <Select
        size="sm"
        aria-label={t('longRentRents.bankImport.review.pick', { date, amount })}
        value={row.installmentId}
        onChange={(event) => onInstallment(event.target.value)}
        wrapperClassName="pl-7"
      >
        <option value="">{t('longRentRents.bankImport.review.choose')}</option>
        {optionsOf(row).map((installment) => (
          <option key={installment.id} value={installment.id} disabled={elsewhere.has(installment.id)}>
            {installmentTitle(installment, unknownTenant)} · {installmentWhat(installment, language, t)}
            {elsewhere.has(installment.id) ? ` · ${t('longRentRents.bankImport.review.taken')}` : ''}
          </option>
        ))}
      </Select>
    </li>
  );
}

function UnmatchedRow({ credit, language }: { credit: BankImportCredit; language: string }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-start gap-3 p-3" data-testid="bank-import-unmatched-row">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="break-words font-medium">{t('longRentRents.bankImport.review.credit', { date: fullDay(credit.date, language) })}</p>
        {credit.payer ? <p className="break-words text-xs text-foreground/70">{credit.payer}</p> : null}
        <p className="line-clamp-2 break-words text-xs text-foreground/70">{credit.description}</p>
      </div>
      <p className="whitespace-nowrap font-medium">{formatCurrency(credit.amount, credit.currency)}</p>
    </li>
  );
}
