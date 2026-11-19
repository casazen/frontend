import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { touristTaxAmountLabel } from '@/lib/tourist-tax';
import { todayInRome } from '@/lib/stay-dates';
import { useMunicipalTouristTaxRates } from '@/queries/use-billing-setup';
import { useProperties } from '@/queries/use-properties';
import type { TouristTaxRate } from '@/types/tourist-tax.types';
import { PORTAL_SOURCES, type BillingWizardValues } from '../billing-wizard-schema';

/** A comune written the way two lists of comuni can be compared: no accents, no case, no spaces at the ends. */
function comuneKey(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** The rate of a comune that is in force today, from the rates the server sends. */
function rateInForce(rates: readonly TouristTaxRate[], city: string, today: string): TouristTaxRate | undefined {
  const key = comuneKey(city);
  return rates.find((rate) => {
    if (!rate.isActive || comuneKey(rate.city) !== key) return false;
    const from = String(rate.effectiveFrom).slice(0, 10);
    const to = rate.effectiveTo ? String(rate.effectiveTo).slice(0, 10) : null;
    return from <= today && (to === null || to >= today);
  });
}

/**
 * The tourist tax of a Swiss issuer: for each portal, who collects it. A portal that collects it leaves no line on the document of its bookings; for the others the document
 * carries the line, with the rule of the canton. Every portal is answered, so that nobody confirms a choice by not making it: the server has a default for an issuer that
 * has not confirmed (the configuration of the tourist tax), and it is confirmed here, with the person's own answer. The portals that default says collect it (`proposed`) are
 * already chosen for an issuer that has not answered, so that only the others are left to answer: the person checks them and changes them if they are not right.
 */
function SwissTouristTax({ proposed }: { proposed: readonly string[] }) {
  const { t } = useTranslation();
  const {
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();

  // The proposal goes into the answer of a portal that has none yet and never over one that has: not what the setup saved (nothing is proposed then), not what the person chose. The form starts
  // from the setup as it was when the wizard opened, so an issuer that chose its country in this very wizard has its proposal only now, when the step opens.
  const proposal = proposed.join('|');
  useEffect(() => {
    for (const portal of PORTAL_SOURCES) {
      if (proposal.split('|').includes(portal) && getValues(`touristTaxCollectors.${portal}`) === '') setValue(`touristTaxCollectors.${portal}`, 'portal');
    }
  }, [proposal, getValues, setValue]);

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.touristTax.swiss.intro')}</p>
      {proposed.length > 0 ? (
        <p className="text-sm text-foreground/80" data-testid="billing-tourist-tax-proposed">
          {t('billingWizard.touristTax.swiss.proposed', {
            choice: t('billingWizard.touristTax.swiss.portal'),
            portals: PORTAL_SOURCES.filter((portal) => proposed.includes(portal))
              .map((portal) => t(`booking.source.${portal}`))
              .join(', '),
          })}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2" data-testid="billing-tourist-tax-swiss">
        {PORTAL_SOURCES.map((portal) => (
          <Field key={portal} label={t(`booking.source.${portal}`)} error={errors.touristTaxCollectors?.[portal]}>
            <Select data-testid={`billing-collector-${portal}`} {...register(`touristTaxCollectors.${portal}`)}>
              <option value="">{t('billingWizard.touristTax.swiss.choose')}</option>
              <option value="portal">{t('billingWizard.touristTax.swiss.portal')}</option>
              <option value="host">{t('billingWizard.touristTax.swiss.host')}</option>
            </Select>
          </Field>
        ))}
      </div>
      <p className="text-sm text-foreground/70">{t('billingWizard.touristTax.swiss.note')}</p>
    </>
  );
}

/**
 * The tourist tax of an Italian issuer: nothing is set here. The municipal rules (the rate of each comune) are CasaZen's, and the step only reads them: for the comune of each
 * property, the rate in force. A comune with no rate is a thing to do, said as such (CasaZen adds the rate: the person is not asked to), and never a way out of the wizard.
 */
function ItalianTouristTax() {
  const { t } = useTranslation();
  const today = todayInRome();
  // The list is read again whenever the step opens: a property is created or changed on other pages, where this list is not watched, and the app keeps a list it has read for
  // five minutes and never reads it again on mount. A comune of a property that is not in the list would be left out of the «Da fare».
  const properties = useProperties({ mode: 'short' }, { fresh: true });
  const rates = useMunicipalTouristTaxRates(true);

  const comuni = useMemo(() => {
    const found = new Map<string, string>();
    for (const property of Array.isArray(properties.data) ? properties.data : []) {
      const city = property.city?.trim();
      if (city && !found.has(comuneKey(city))) found.set(comuneKey(city), city);
    }
    return [...found.values()].sort((a, b) => a.localeCompare(b));
  }, [properties.data]);

  if (properties.isPending || rates.isPending) {
    return <SkeletonLine lines={2} lineClassName="h-10" label={t('billingWizard.touristTax.italy.loading')} />;
  }
  if (properties.isError || rates.isError) {
    return (
      <Alert variant="warning" data-testid="billing-tourist-tax-italy-unavailable">
        {t('billingWizard.touristTax.italy.unavailable')}
      </Alert>
    );
  }

  const rows = comuni.map((city) => ({ city, rate: rateInForce(rates.data ?? [], city, today) }));
  const missing = rows.filter((row) => !row.rate).map((row) => row.city);

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.touristTax.italy.intro')}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="billing-tourist-tax-italy-empty">
          {t('billingWizard.touristTax.italy.empty')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border" data-testid="billing-tourist-tax-italy">
          {rows.map(({ city, rate }) => (
            <li key={city} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm" data-testid="billing-tourist-tax-comune">
              <span className="min-w-0 break-words font-medium">{city}</span>
              {rate ? (
                <span className="flex min-w-0 items-center gap-2 break-words text-foreground/80">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />
                  {touristTaxAmountLabel(rate, t)}
                </span>
              ) : (
                <span className="min-w-0 break-words text-foreground/80">{t('billingWizard.touristTax.italy.noRate')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 ? (
        <Alert variant="warning" title={t('billingWizard.touristTax.italy.toDoTitle')} data-testid="billing-tourist-tax-italy-todo">
          {t('billingWizard.touristTax.italy.toDo', { count: missing.length, comuni: missing.join(', ') })}
        </Alert>
      ) : null}
    </>
  );
}

interface TouristTaxStepProps {
  /** The country of the issuer, as answered in the first step: the step is the portals' for Switzerland and a reading of the municipal rules for Italy. */
  country: string;
  /**
   * The portals the server says collect the Swiss tourist tax by default, while the issuer has not confirmed its own list (`platformDefaultsOf` of the setup): they are chosen for the
   * portals that have no answer yet. None once the issuer has saved a list.
   */
  proposed?: readonly string[];
}

/** Step 4, «Tassa di soggiorno»: Switzerland asks who collects it for every portal (the ones that collect it by default already chosen); Italy only shows the municipal rules that exist. */
export function TouristTaxStep({ country, proposed = [] }: TouristTaxStepProps) {
  const { t } = useTranslation();
  if (country === 'CH') return <SwissTouristTax proposed={proposed} />;
  if (country === 'IT') return <ItalianTouristTax />;
  return <p className="text-sm text-foreground/70">{t('billingWizard.touristTax.noCountry')}</p>;
}
