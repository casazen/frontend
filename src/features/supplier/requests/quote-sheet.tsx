import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { todayInRome } from '@/lib/stay-dates';
import type { SendServiceRequestQuoteDto, SupplierServiceRequest } from '@/types/service-request';
import { formatMoney } from '../services/lib/service-money';
import {
  emptyQuoteForm,
  newRowKey,
  payloadOf,
  problemsOf,
  QUOTE_LIMITS,
  quoteFormOf,
  totalCentsOf,
  type QuoteForm,
  type QuoteRow,
} from './quote-form';
import { requestWhen, workMinutes } from './request-model';

const T = 'supplier.requests.quote';

/**
 * The sheet where the supplier answers a new request with a quote (SP-04b), or changes the one that waits: lines (what and how much, from 1
 * to 20), the live total, a note and, if it wants, another time. It is a dialog in the middle of the screen and a sheet from the bottom on a
 * phone. Nothing leaves before «Invia il preventivo»; the time is not held for the customer until they accept.
 */
export function QuoteSheet({
  request,
  isPending,
  onCancel,
  onSubmit,
}: {
  request: SupplierServiceRequest;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (quote: SendServiceRequestQuoteDto) => void;
}) {
  const { t, i18n } = useTranslation();
  const decimal = i18n.language.startsWith('it') ? ',' : '.';
  const editing = Boolean(request.quote);
  const showcase = request.source === 'showcase';
  const [form, setForm] = useState<QuoteForm>(() => (request.quote ? quoteFormOf(request.quote, decimal) : emptyQuoteForm()));
  // The mistakes are told after the first try to send, not while the person is still writing the first line.
  const [tried, setTried] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const problems = problemsOf(form);
  const total = totalCentsOf(form.rows);
  const when = requestWhen(request, i18n.language, true);
  const whenText = [when.day, when.time].filter(Boolean).join(', ');

  // The row the person just added takes the focus, so they can go on typing.
  useEffect(() => {
    if (focusKey) document.getElementById(`${focusKey}-label`)?.focus();
  }, [focusKey]);

  const change = (patch: Partial<QuoteForm>) => setForm((current) => ({ ...current, ...patch }));
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The sheet is drawn outside the page but sits inside it for React: the form around a page must not hear this submit.
    event.stopPropagation();
    if (isPending) return;
    setTried(true);
    if (!problems.valid) return;
    onSubmit(payloadOf(form, workMinutes(request.scheduledStart, request.scheduledEnd)));
  };

  const rowError = (problem: string | null) => (tried && problem ? `${T}.errors.${problem}` : undefined);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-xl" data-testid="quote-sheet">
        <DialogHeader>
          <DialogTitle>{t(editing ? `${T}.titleEdit` : `${T}.title`)}</DialogTitle>
          <DialogDescription>{t(editing ? `${T}.introEdit` : `${T}.intro`)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-5" noValidate>
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
              onChange={(event) => change({ note: event.target.value })}
              data-testid="quote-note"
            />
          </Field>

          <section className="space-y-2" aria-labelledby="quote-when-title" data-testid="quote-when">
            <h3 id="quote-when-title" className="text-sm font-semibold">
              {t(`${T}.when.title`)}
            </h3>
            {form.otherTime ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t(`${T}.when.day`)} error={tried && problems.time ? `${T}.errors.${problems.time}` : undefined}>
                    <Input
                      type="date"
                      value={form.day}
                      min={todayInRome()}
                      onChange={(event) => change({ day: event.target.value })}
                      data-testid="quote-other-day"
                    />
                  </Field>
                  <Field label={t(`${T}.when.start`)}>
                    <Input type="time" value={form.time} onChange={(event) => change({ time: event.target.value })} data-testid="quote-other-time" />
                  </Field>
                </div>
                <p className="text-sm text-foreground/70">{t(`${T}.when.hint`)}</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-11 px-2 text-primary-text hover:text-primary-text"
                  onClick={() => change({ otherTime: false, day: '', time: '' })}
                  data-testid="quote-keep-time"
                >
                  {t(`${T}.when.keep`)}
                </Button>
              </>
            ) : (
              <>
                <p className="break-words text-sm text-foreground/80" data-testid="quote-same-time">
                  {whenText ? t(`${T}.when.same`, { when: whenText }) : t(`${T}.when.none`)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-11 px-2 text-primary-text hover:text-primary-text"
                  onClick={() => change({ otherTime: true })}
                  data-testid="quote-propose-time"
                >
                  {t(`${T}.when.propose`)}
                </Button>
              </>
            )}
          </section>

          <ul role="list" className="list-disc space-y-1 pl-5 text-sm text-foreground/70" data-testid="quote-terms">
            <li>{t(`${T}.terms.limit`)}</li>
            <li>{t(showcase ? `${T}.terms.deadlineShowcase` : `${T}.terms.deadlineHost`)}</li>
          </ul>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              {t(`${T}.cancel`)}
            </Button>
            <Button type="submit" loading={isPending} data-testid="quote-submit">
              {t(editing ? `${T}.update` : `${T}.send`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
