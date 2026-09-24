import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { PublicTouristTaxRateSummary } from '@/types/seo.types';
import { useCalculateTouristTax } from '@/queries/use-public-seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import { addDays, todayInRome } from '@/lib/stay-dates';
import {
  completeChildrenAges,
  resizeChildrenAges,
  touristTaxAgeRulesApply,
  touristTaxAmountLabel,
  touristTaxRuleDetails,
} from '@/lib/tourist-tax';
import { ChildrenAgesFields } from '@/features/tourist-tax/components/children-ages-fields';

interface TouristTaxCalculatorWidgetProps {
  comuneSlug: string;
  comuneName: string;
  /** Rates of the comune in force today (public page); empty when CasaZen has none. */
  rates: PublicTouristTaxRateSummary[];
}

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * Warning shown instead of the calculator when the comune has no rate in CasaZen (A8-12): never a failing
 * calculator, never an invented amount.
 */
export function TouristTaxRateUnavailableNotice({ comuneName }: { comuneName: string }) {
  const { t } = useTranslation();
  return (
    <section
      role="status"
      className="my-8 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      data-testid="tourist-tax-rate-unavailable"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      <div className="space-y-1">
        <h2 className="font-semibold">{t('publicSeo.rateUnavailableTitle', { comuneName })}</h2>
        <p className="text-sm">{t('publicSeo.rateUnavailableHint')}</p>
      </div>
    </section>
  );
}

/**
 * Public tourist tax calculator (A8-12, A8-23): the amount comes from the backend engine used by the checkout.
 * Asks the ages of the minors, the accommodation category or the night price only when the rates of the comune
 * need them.
 */
export function TouristTaxCalculatorWidget({ comuneSlug, comuneName, rates }: TouristTaxCalculatorWidgetProps) {
  const { t } = useTranslation();
  const [today] = useState(() => todayInRome());
  const [numberOfAdults, setNumberOfAdults] = useState(2);
  const [numberOfChildren, setNumberOfChildren] = useState(0);
  const [childrenAgesState, setChildrenAges] = useState<(number | null)[]>([]);
  const [checkInDate, setCheckInDate] = useState(() => addDays(today, 7));
  const [checkOutDate, setCheckOutDate] = useState(() => addDays(today, 11));
  const [category, setCategory] = useState('');
  const [nightlyPrice, setNightlyPrice] = useState('');

  const calculateMutation = useCalculateTouristTax();

  if (rates.length === 0) return <TouristTaxRateUnavailableNotice comuneName={comuneName} />;

  const categories = [...new Set(rates.map((rate) => rate.accommodationCategory).filter((c): c is string => !!c))];
  const needsPrice = rates.some((rate) => rate.calculationMethod === 'PercentOfNightlyPrice');
  const askAges = touristTaxAgeRulesApply(rates);
  const childrenCount = Number.isInteger(numberOfChildren) && numberOfChildren > 0 ? numberOfChildren : 0;
  const childrenAges = askAges ? resizeChildrenAges(childrenAgesState, childrenCount) : [];
  const result = calculateMutation.data;

  async function handleCalculate() {
    const ages = completeChildrenAges(childrenAges);
    const price = Number(nightlyPrice);
    await calculateMutation.mutateAsync({
      comuneSlug,
      numberOfAdults,
      numberOfChildren,
      checkInDate,
      checkOutDate,
      ...(ages ? { childrenAges: ages } : {}),
      ...(category ? { accommodationCategory: category } : {}),
      ...(needsPrice && nightlyPrice !== '' && Number.isFinite(price) ? { nightlyPrice: price } : {}),
    });
  }

  return (
    <section className="my-8 rounded-lg border p-6" data-testid="tourist-tax-calculator-widget">
      <h2 className="text-xl font-semibold">{t('publicSeo.calculateTax')}</h2>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground" data-testid="tourist-tax-rate-summary">
        {rates.map((rate, index) => (
          <li key={`${rate.accommodationCategory ?? ''}-${rate.seasonStart ?? ''}-${index}`}>
            {rate.accommodationCategory && <span className="font-medium">{rate.accommodationCategory}: </span>}
            {[touristTaxAmountLabel(rate, t), ...touristTaxRuleDetails(rate, t)].join(' · ')}
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {categories.length > 0 && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tax-category">{t('publicSeo.categoryLabel')}</Label>
            <select
              id="tax-category"
              className={selectClassName}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              data-testid="tax-category-select"
            >
              <option value="">{t('publicSeo.categoryPlaceholder')}</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="tax-adults">{t('publicBooking.adults')}</Label>
          <Input
            id="tax-adults"
            type="number"
            min={1}
            value={numberOfAdults}
            onChange={(e) => setNumberOfAdults(Number(e.target.value))}
            data-testid="tax-adults-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-children">{t('publicBooking.children')}</Label>
          <Input
            id="tax-children"
            type="number"
            min={0}
            value={numberOfChildren}
            onChange={(e) => setNumberOfChildren(Number(e.target.value))}
            data-testid="tax-children-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-checkin">{t('publicBooking.checkInLabel')}</Label>
          <Input
            id="tax-checkin"
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            data-testid="tax-checkin-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-checkout">{t('publicBooking.checkOutLabel')}</Label>
          <Input
            id="tax-checkout"
            type="date"
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
            data-testid="tax-checkout-input"
          />
        </div>
        {needsPrice && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tax-nightly-price">{t('publicSeo.nightlyPriceLabel')}</Label>
            <Input
              id="tax-nightly-price"
              type="number"
              min={0}
              step="0.01"
              value={nightlyPrice}
              onChange={(e) => setNightlyPrice(e.target.value)}
              data-testid="tax-nightly-price-input"
            />
          </div>
        )}
      </div>

      {childrenAges.length > 0 && (
        <div className="mt-4">
          <ChildrenAgesFields ages={childrenAges} onChange={setChildrenAges} idPrefix="tax" />
        </div>
      )}

      <Button
        className="mt-4"
        onClick={() => void handleCalculate().catch(() => undefined)}
        disabled={calculateMutation.isPending}
        data-testid="tax-calculate-button"
      >
        {calculateMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('publicSeo.calculating')}
          </>
        ) : (
          t('publicSeo.calculate')
        )}
      </Button>

      {result && !calculateMutation.isError && (
        <div className="mt-4 rounded-md bg-muted p-4" data-testid="tax-calculation-result">
          {result.status === 'Calculated' ? (
            <>
              <p className="text-lg font-semibold">
                {t('publicSeo.estimatedTax', { amount: formatCurrency(result.taxAmount ?? 0) })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('publicSeo.taxableNights', { count: result.nights, taxable: result.taxableNights })}
              </p>
            </>
          ) : (
            <p className="font-medium" data-testid="tax-calculation-status">
              {t(`publicSeo.quoteStatus.${result.status}`)}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t('publicSeo.estimateDisclaimer')}</p>
        </div>
      )}

      {calculateMutation.isError && (
        <p className="mt-4 text-sm text-destructive" role="alert" data-testid="tax-calculation-error">
          {getProblemMessage(calculateMutation.error, t) ?? t('publicSeo.calculationError')}
        </p>
      )}
    </section>
  );
}
