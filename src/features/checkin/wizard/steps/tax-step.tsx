import { useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { selectClassName } from '@/features/checkin/components/stay-guest-fields';
import { getProblemMessage } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import { useSetTouristTaxCollector, useSetTouristTaxExemptions, useStayTouristTax } from '@/queries/use-checkin-wizard';
import type { CheckInWizardState, StayTouristTax, StayTouristTaxGuest, TouristTaxCollector } from '@/types/checkin-wizard.types';
import { exemptionOf, taxBreakdownOf, taxOutlook, type CheckInWizardValues } from '../lib/checkin-wizard-model';
import { TaxRateSubstep } from './tax-rate-substep';

/** The reasons the host may choose have a plain-words label under the key the API gives (`touristTax.exemption.<code>`). */
const EXEMPTION_LABEL_KEYS: Readonly<Record<string, string>> = {
  resident: 'touristTax.exemption.resident',
  health_care: 'touristTax.exemption.health_care',
  disability_companion: 'touristTax.exemption.disability_companion',
  public_service: 'touristTax.exemption.public_service',
  host_family: 'touristTax.exemption.host_family',
  other: 'touristTax.exemption.other',
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Who may have collected the tax of a channel stay. */
const COLLECTORS = ['Channel', 'Host'] as const satisfies readonly TouristTaxCollector[];

/** The label of an exemption reason: the plain words of the code the API knows, otherwise the code itself. */
function exemptionLabel(code: string, labelKey: string | undefined, t: TranslateFn): string {
  const key = EXEMPTION_LABEL_KEYS[code];
  if (key) return t(key);
  return labelKey && labelKey !== code ? t(labelKey) : code;
}

interface TaxGuestRowProps {
  index: number;
  guest: StayTouristTaxGuest;
  name: string;
  tax: StayTouristTax;
  /** The exemption code of the guest in the form of the wizard. */
  code: string;
  money: (amount: number) => string;
  busy: boolean;
  onChange: (code: string) => void;
}

/** One guest of the tax: nights, taxable nights, the exemption (a minor exempt by age is shown, not selectable) and the amount. */
function TaxGuestRow({ index, guest, name, tax, code, money, busy, onChange }: TaxGuestRowProps) {
  const { t } = useTranslation();
  const selectId = `tax-exemption-${index}`;
  const byAge = guest.exemptionKind === 'Age';
  // An exemption whose reason this person may not read: it is there, and it is not shown (art. 9 GDPR).
  const hidden = guest.exemptionKind === 'Host' && !guest.exemptionCode;
  const reasons = tax.reasons;
  const knownCode = code === '' || reasons.some((reason) => reason.code === code);

  return (
    <li className="space-y-2 rounded-md border p-3" data-testid={`tax-guest-${index}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{name}</span>
        <span className="text-sm" data-testid={`tax-guest-${index}-amount`}>
          {guest.amount === null ? t('checkin.wizard.tax.noAmount') : money(guest.amount)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('checkin.wizard.tax.nights', { nights: guest.nights, taxable: guest.taxableNights })}
      </p>
      {byAge ? (
        <p className="text-sm" data-testid={`tax-guest-${index}-age`}>
          {t('checkin.wizard.tax.exemptByAge')}
        </p>
      ) : hidden ? (
        <p className="text-sm" data-testid={`tax-guest-${index}-hidden`}>
          {t('checkin.wizard.tax.exemptHidden')}
        </p>
      ) : (
        <div className="space-y-1">
          <Label htmlFor={selectId}>{t('checkin.wizard.tax.exemptionLabel')}</Label>
          <select
            id={selectId}
            className={`${selectClassName} h-11`}
            value={code}
            disabled={busy}
            onChange={(event) => onChange(event.target.value)}
            data-testid={selectId}
          >
            <option value="">{t('checkin.wizard.tax.noExemption')}</option>
            {!knownCode && <option value={code}>{exemptionLabel(code, undefined, t)}</option>}
            {reasons.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {exemptionLabel(reason.code, reason.labelKey, t)}
              </option>
            ))}
          </select>
        </div>
      )}
    </li>
  );
}

interface TaxStepProps {
  bookingId: string;
  form: UseFormReturn<CheckInWizardValues>;
  state: CheckInWizardState;
}

/**
 * The tourist tax step (NF-46, ADR-037): per guest the nights, the taxable nights, the exemption and the amount, then the breakdown of the
 * stay. A minor exempt by age is shown as automatic; the host chooses any other exemption from a list in plain words. When the channel
 * collected the tax the step says so and shows the amounts; when nobody knows who collected it, it asks; when no rate is known it never
 * shows a zero and offers "Enter your municipality tax", which returns to this same step.
 */
export function TaxStep({ bookingId, form, state }: TaxStepProps) {
  const { t, i18n } = useTranslation();
  const taxQuery = useStayTouristTax(bookingId);
  const setExemptions = useSetTouristTaxExemptions(bookingId);
  const setCollector = useSetTouristTaxCollector(bookingId);
  const guests = useWatch({ control: form.control, name: 'guests' });
  const [rateOpen, setRateOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const money = (amount: number) => formatCurrency(amount, 'EUR', i18n.language.startsWith('en') ? 'en-GB' : 'it-IT');
  const { propertyId } = state.booking;

  if (taxQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="checkin-wizard-tax-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('checkin.wizard.loading')}
      </p>
    );
  }
  if (taxQuery.isError || !taxQuery.data) {
    return (
      <div className="space-y-2" data-testid="checkin-wizard-tax-error">
        <p role="alert" className="text-sm text-destructive">
          {getProblemMessage(taxQuery.error, t) ?? t('checkin.wizard.tax.loadFailed')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void taxQuery.refetch()}>
          {t('checkin.wizard.retry')}
        </Button>
      </div>
    );
  }

  const tax = taxQuery.data;
  const outlook = taxOutlook(tax);
  const busy = setExemptions.isPending || setCollector.isPending;

  const chooseExemption = (index: number, code: string) => {
    const path = `guests.${index}.taxExemptionCode` as const;
    const previous = form.getValues(path);
    form.setValue(path, code, { shouldDirty: false });
    setProblem(null);
    // Only this guest goes (a null code clears the exemption): the others, whose reason the host may not be allowed to see, stay as they are.
    setExemptions.mutate(exemptionOf(index, code), {
      onError: (error) => {
        form.setValue(path, previous, { shouldDirty: false });
        setProblem(getProblemMessage(error, t) ?? t('checkin.wizard.tax.exemptionFailed'));
      },
    });
  };

  const chooseCollector = (collector: TouristTaxCollector) => {
    setProblem(null);
    setCollector.mutate(collector, {
      onError: (error) => setProblem(getProblemMessage(error, t) ?? t('checkin.wizard.tax.collectorFailed')),
    });
  };

  const nameOf = (position: number) => {
    const guest = guests[position];
    return `${guest?.firstName ?? ''} ${guest?.lastName ?? ''}`.trim() || t('checkin.guestHeading', { index: position + 1 });
  };

  const showAmounts = outlook === 'toCollect' || outlook === 'collectedByChannel' || outlook === 'collectorNeeded';
  const breakdown = showAmounts ? taxBreakdownOf(tax) : null;
  const canChooseCollector = tax.collectorNeeded || tax.collectorSource === 'HostDeclared';

  return (
    <div className="space-y-5" data-testid="checkin-wizard-tax">
      <p className="text-sm text-muted-foreground">{t('checkin.wizard.tax.intro')}</p>

      {outlook === 'missingRate' && (
        <Alert
          variant="warning"
          title={t('checkin.wizard.tax.missingRateTitle')}
          data-testid="checkin-wizard-tax-missing-rate"
          action={
            !rateOpen ? (
              <Button type="button" size="sm" onClick={() => setRateOpen(true)} data-testid="checkin-wizard-tax-enter-rate">
                {t('checkin.wizard.tax.enterRate')}
              </Button>
            ) : undefined
          }
        >
          {t('checkin.wizard.tax.missingRateText')}
        </Alert>
      )}

      {outlook === 'notCalculable' && (
        <Alert variant="info" title={t('checkin.wizard.tax.notCalculableTitle')} data-testid="checkin-wizard-tax-not-calculable">
          {t(`checkin.wizard.tax.notCalculable.${tax.status}`)}
        </Alert>
      )}

      {rateOpen && (
        <TaxRateSubstep bookingId={bookingId} propertyId={propertyId} checkIn={state.booking.checkIn} onClose={() => setRateOpen(false)} />
      )}

      {outlook === 'collectedByChannel' && breakdown && (
        <Alert variant="success" title={t('checkin.wizard.tax.channelCollectedTitle')} data-testid="checkin-wizard-tax-channel">
          {t('checkin.wizard.tax.channelCollectedText', { total: breakdown.total === null ? '' : money(breakdown.total) })}
        </Alert>
      )}

      {canChooseCollector && (
        <fieldset className="space-y-2" disabled={busy} data-testid="checkin-wizard-tax-collector">
          <legend className="text-sm font-medium">{t('checkin.wizard.tax.collectorQuestion')}</legend>
          {COLLECTORS.map((collector) => (
            <label key={collector} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name="tax-collector"
                className="size-4"
                checked={tax.collector === collector}
                onChange={() => chooseCollector(collector)}
                data-testid={`tax-collector-${collector}`}
              />
              {collector === 'Channel' ? t('checkin.wizard.tax.collectorChannel') : t('checkin.wizard.tax.collectorHost')}
            </label>
          ))}
        </fieldset>
      )}

      {showAmounts && (
        <ul className="space-y-3" data-testid="checkin-wizard-tax-guests">
          {tax.guests.map((guest) => (
            <TaxGuestRow
              key={guest.position}
              index={guest.position}
              guest={guest}
              name={nameOf(guest.position)}
              tax={tax}
              code={guests[guest.position]?.taxExemptionCode ?? ''}
              money={money}
              busy={busy}
              onChange={(code) => chooseExemption(guest.position, code)}
            />
          ))}
        </ul>
      )}

      {breakdown && (
        <section aria-labelledby="tax-breakdown-title" className="space-y-2" data-testid="checkin-wizard-tax-breakdown">
          <h3 id="tax-breakdown-title" className="text-base font-semibold">
            {t('checkin.wizard.tax.breakdownTitle')}
          </h3>
          <dl className="divide-y rounded-md border text-sm">
            <BreakdownRow label={t('checkin.wizard.tax.breakdown.nights')} value={String(breakdown.nights)} />
            <BreakdownRow label={t('checkin.wizard.tax.breakdown.guests')} value={String(breakdown.guests)} />
            <BreakdownRow label={t('checkin.wizard.tax.breakdown.exempt')} value={String(breakdown.exemptGuests)} />
            <BreakdownRow
              label={t('checkin.wizard.tax.breakdown.rate')}
              value={
                breakdown.perPersonPerNight === null
                  ? t('checkin.wizard.tax.breakdown.rateFrom', { source: t(`checkin.wizard.tax.rateSource.${tax.rateSource}`) })
                  : t('checkin.wizard.tax.breakdown.ratePerNight', {
                      amount: money(breakdown.perPersonPerNight),
                      source: t(`checkin.wizard.tax.rateSource.${tax.rateSource}`),
                    })
              }
            />
            <BreakdownRow
              label={t('checkin.wizard.tax.breakdown.cap')}
              value={
                breakdown.capApplied
                  ? t('checkin.wizard.tax.breakdown.capApplied', { taxable: breakdown.taxableNights, nights: breakdown.nights })
                  : t('checkin.wizard.tax.breakdown.capNotApplied')
              }
            />
            <BreakdownRow
              label={t('checkin.wizard.tax.breakdown.total')}
              value={breakdown.total === null ? t('checkin.wizard.tax.noAmount') : money(breakdown.total)}
              strong
            />
          </dl>
          {tax.rateSource === 'HostDeclared' && !rateOpen && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setRateOpen(true)} data-testid="checkin-wizard-tax-edit-rate">
              {t('checkin.wizard.tax.editRate')}
            </Button>
          )}
        </section>
      )}

      {problem && (
        <p role="alert" className="text-sm text-destructive" data-testid="checkin-wizard-tax-problem">
          {problem}
        </p>
      )}
    </div>
  );
}

function BreakdownRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-semibold' : 'font-medium'}>{value}</dd>
    </div>
  );
}
