import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import type { SendSupplierOfferBody, SupplierOffer } from '@/types/supplier-inquiry';
import { QuoteLinesFields } from '../requests/quote-lines-fields';
import { emptyOfferForm, offerFormOf, offerPayloadOf, offerProblemsOf, type OfferForm } from './offer-form';

const T = 'supplier.inquiry.offer';
const Q = 'supplier.requests.quote';

/**
 * The sheet where the supplier answers a request on measure with an offer (SP-10b-b, SP-08e), or replaces the one that waits: lines (what
 * and how much), the live total, a note and the time, which an offer always has (the day, the start and how long the work lasts). It is
 * the sheet of the quote (decision SP-D30: one engine, not a second mechanism) with the time made mandatory. A dialog in the middle of the
 * screen, a sheet from the bottom on a phone. Nothing leaves before «Invia l'offerta»; the time is not held for the customer until they
 * accept, and the agenda judges it again then. When the server refuses (a time the agenda cannot do, a request that changed) the sheet stays
 * open and says why where the supplier is looking.
 */
export function OfferSheet({
  offer,
  onCancel,
  onSubmit,
}: {
  /** The offer that waits, to replace it; empty for the first one. */
  offer: SupplierOffer | null;
  onCancel: () => void;
  onSubmit: (body: SendSupplierOfferBody) => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation();
  const decimal = i18n.language.startsWith('it') ? ',' : '.';
  const replacing = offer !== null;
  const [form, setForm] = useState<OfferForm>(() => (offer ? offerFormOf(offer, decimal) : emptyOfferForm()));
  // The mistakes are told after the first try to send, not while the person is still writing the first line.
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const problems = offerProblemsOf(form);
  const changeQuote = (update: (current: OfferForm['quote']) => OfferForm['quote']) => setForm((current) => ({ ...current, quote: update(current.quote) }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The sheet is drawn outside the page but sits inside it for React: the form around a page must not hear this submit.
    event.stopPropagation();
    if (pending) return;
    setTried(true);
    setRefused(null);
    const body = problems.valid ? offerPayloadOf(form) : null;
    if (!body) return;
    setPending(true);
    try {
      await onSubmit(body);
      onCancel();
    } catch (error) {
      // Stays open: the time may not be free, the offer may be outside the limits, the request may have changed meanwhile.
      setRefused(getProblemMessage(error, t) ?? t(`${T}.failed`));
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent className="sm:max-w-xl" data-testid="offer-sheet">
        <DialogHeader>
          <DialogTitle>{t(replacing ? `${T}.titleReplace` : `${T}.title`)}</DialogTitle>
          <DialogDescription>{t(replacing ? `${T}.introReplace` : `${T}.intro`)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="grid gap-5" noValidate>
          <QuoteLinesFields
            form={form.quote}
            setForm={(update) => changeQuote((current) => (typeof update === 'function' ? update(current) : update))}
            problems={problems.quote}
            tried={tried}
          />

          <section className="space-y-2" aria-labelledby="offer-when-title" data-testid="offer-when">
            <h3 id="offer-when-title" className="text-sm font-semibold">
              {t(`${T}.when.title`)}
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t(`${T}.when.day`)} error={tried && problems.time ? `${T}.errors.${problems.time}` : undefined}>
                <Input
                  type="date"
                  value={form.quote.day}
                  min={todayInRome()}
                  onChange={(event) => changeQuote((current) => ({ ...current, day: event.target.value }))}
                  data-testid="offer-day"
                />
              </Field>
              <Field label={t(`${T}.when.start`)}>
                <Input type="time" value={form.quote.time} onChange={(event) => changeQuote((current) => ({ ...current, time: event.target.value }))} data-testid="offer-time" />
              </Field>
              <Field label={t(`${T}.when.hours`)} error={tried && problems.duration ? `${T}.errors.${problems.duration}` : undefined}>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  value={form.hours}
                  onChange={(event) => setForm((current) => ({ ...current, hours: event.target.value }))}
                  data-testid="offer-hours"
                />
              </Field>
            </div>
            <p className="text-sm text-foreground/70">{t(`${T}.when.hint`)}</p>
          </section>

          <ul role="list" className="list-disc space-y-1 pl-5 text-sm text-foreground/70" data-testid="offer-terms">
            <li>{t(`${Q}.terms.limit`)}</li>
            <li>{t(`${Q}.terms.deadlineShowcase`)}</li>
          </ul>

          {refused ? (
            <p role="alert" className="text-sm font-medium text-danger-foreground" data-testid="offer-refused">
              {refused}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              {t(`${Q}.cancel`)}
            </Button>
            <Button type="submit" loading={pending} data-testid="offer-submit">
              {t(replacing ? `${T}.update` : `${T}.send`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
