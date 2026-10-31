import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '../services/lib/service-money';
import { newRowKey, QUOTE_LIMITS, totalCentsOf, type QuoteForm, type QuoteProblems, type QuoteRow } from './quote-form';

const T = 'supplier.requests.quote';

/**
 * The lines of a quote and the note, with the total that adds up as the supplier writes (SP-04b): what the sheet of the quote and the sheet of
 * the offer on a request on measure (SP-08e, decision SP-D30: one engine) have in common. The sheet owns the form and the rest of it (the
 * time, the terms, the buttons); this draws the lines and keeps the row that was just added in focus. The mistakes are told after the first
 * try to send, not while the person is still writing the first line.
 */
export function QuoteLinesFields({
  form,
  setForm,
  problems,
  tried,
}: {
  form: QuoteForm;
  setForm: Dispatch<SetStateAction<QuoteForm>>;
  problems: QuoteProblems;
  tried: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const total = totalCentsOf(form.rows);

  // The row the person just added takes the focus, so they can go on typing.
  useEffect(() => {
    if (focusKey) document.getElementById(`${focusKey}-label`)?.focus();
  }, [focusKey]);

  const changeRow = (key: string, patch: Partial<QuoteRow>) =>
    setForm((current) => ({ ...current, rows: current.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)) }));
  const addRow = () => {
    const key = newRowKey();
    setForm((current) =>
      current.rows.length >= QUOTE_LIMITS.maxLines ? current : { ...current, rows: [...current.rows, { key, label: '', amount: '' }] },
    );
    setFocusKey(key);
  };
  const removeRow = (key: string) =>
    setForm((current) => (current.rows.length <= 1 ? current : { ...current, rows: current.rows.filter((row) => row.key !== key) }));

  const rowError = (problem: string | null) => (tried && problem ? `${T}.errors.${problem}` : undefined);

  return (
    <>
      <fieldset className="min-w-0 space-y-3">
        <legend className="mb-2 text-sm font-semibold">{t(`${T}.lines`)}</legend>
        <ul role="list" className="space-y-3" data-testid="quote-lines">
          {form.rows.map((row, index) => {
            const number = index + 1;
            const rowProblems = problems.rows[row.key];
            return (
              <li
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
                data-testid="quote-line"
              >
                <div className="col-span-2 sm:col-span-1">
                  <Field label={<span className="sr-only">{t(`${T}.line`, { number })}</span>} error={rowError(rowProblems?.label ?? null)}>
                    <Input
                      id={`${row.key}-label`}
                      value={row.label}
                      maxLength={QUOTE_LIMITS.labelMaxLength}
                      autoComplete="off"
                      placeholder={t(`${T}.linePlaceholder`)}
                      onChange={(event) => changeRow(row.key, { label: event.target.value })}
                      data-testid="quote-line-label"
                    />
                  </Field>
                </div>
                <Field label={<span className="sr-only">{t(`${T}.amount`, { number })}</span>} error={rowError(rowProblems?.amount ?? null)}>
                  {(field) => (
                    <div className="relative">
                      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-foreground/70">
                        €
                      </span>
                      <Input
                        {...field}
                        value={row.amount}
                        inputMode="decimal"
                        autoComplete="off"
                        className="pl-8"
                        placeholder={t(`${T}.amountPlaceholder`)}
                        onChange={(event) => changeRow(row.key, { amount: event.target.value })}
                        data-testid="quote-line-amount"
                      />
                    </div>
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-1.5 size-11 shrink-0 px-0 text-danger-foreground hover:text-danger-foreground"
                  aria-label={t(`${T}.remove`, { number })}
                  disabled={form.rows.length <= 1}
                  onClick={() => removeRow(row.key)}
                  data-testid="quote-line-remove"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 w-full sm:w-auto"
          disabled={form.rows.length >= QUOTE_LIMITS.maxLines}
          onClick={addRow}
          data-testid="quote-line-add"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t(`${T}.add`)}
        </Button>
        {form.rows.length >= QUOTE_LIMITS.maxLines ? <p className="text-sm text-foreground/70">{t(`${T}.maxLines`, { count: QUOTE_LIMITS.maxLines })}</p> : null}
      </fieldset>

      <div className="space-y-1 border-t pt-3" data-testid="quote-total-block">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{t(`${T}.total`)}</span>
          <strong className="text-xl tabular-nums" data-testid="quote-total">
            {formatMoney(total, i18n.language)}
          </strong>
        </p>
        {tried && problems.total ? (
          <p role="alert" className="text-sm font-medium text-danger-foreground">
            {t(`${T}.errors.${problems.total}`)}
          </p>
        ) : null}
      </div>

      <Field label={t(`${T}.note`)} optional counter={`${form.note.length}/${QUOTE_LIMITS.noteMaxLength}`}>
        <Textarea
          value={form.note}
          maxLength={QUOTE_LIMITS.noteMaxLength}
          placeholder={t(`${T}.notePlaceholder`)}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          data-testid="quote-note"
        />
      </Field>
    </>
  );
}
