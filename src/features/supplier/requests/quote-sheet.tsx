import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { todayInRome } from '@/lib/stay-dates';
import type { SendServiceRequestQuoteDto, SupplierServiceRequest } from '@/types/service-request';
import { emptyQuoteForm, payloadOf, problemsOf, quoteFormOf, type QuoteForm } from './quote-form';
import { QuoteLinesFields } from './quote-lines-fields';
import { requestWhen, workMinutes } from './request-model';

const T = 'supplier.requests.quote';

/**
 * The sheet where the supplier answers a new request with a quote (SP-04b), or changes the one that waits: lines (what and how much, from 1
 * to 20), the live total, a note and, if it wants, another time. It is a dialog in the middle of the screen and a sheet from the bottom on a
 * phone. Nothing leaves before «Invia il preventivo»; the time is not held for the customer until they accept. The lines and the note are
 * `QuoteLinesFields`, which the sheet of the offer on a request on measure (SP-08e) uses too.
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

  const problems = problemsOf(form);
  const when = requestWhen(request, i18n.language, true);
  const whenText = [when.day, when.time].filter(Boolean).join(', ');

  const change = (patch: Partial<QuoteForm>) => setForm((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The sheet is drawn outside the page but sits inside it for React: the form around a page must not hear this submit.
    event.stopPropagation();
    if (isPending) return;
    setTried(true);
    if (!problems.valid) return;
    onSubmit(payloadOf(form, workMinutes(request.scheduledStart, request.scheduledEnd)));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-xl" data-testid="quote-sheet">
        <DialogHeader>
          <DialogTitle>{t(editing ? `${T}.titleEdit` : `${T}.title`)}</DialogTitle>
          <DialogDescription>{t(editing ? `${T}.introEdit` : `${T}.intro`)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-5" noValidate>
          <QuoteLinesFields form={form} setForm={setForm} problems={problems} tried={tried} />

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
