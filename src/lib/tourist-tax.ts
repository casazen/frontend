import { formatCurrency } from '@/lib/utils';
import type { TouristTaxRateRule } from '@/types/tourist-tax.types';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Oldest age of a minor: adults (18+) are never exempt by age (backend `TouristTaxCalculator.AdultAge`). */
export const MINOR_MAX_AGE = 17;

const percentFormat = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

/** `MM-dd` → `dd/MM`. */
function seasonDay(value: string): string {
  const [month, day] = value.split('-');
  return `${day}/${month}`;
}

/** Amount of a rate: "6,00 € a persona per notte" or "10,5% del prezzo per persona per notte, massimo 7,00 €". */
export function touristTaxAmountLabel(rule: TouristTaxRateRule, t: TranslateFn): string {
  if (rule.calculationMethod === 'PercentOfNightlyPrice') {
    const percent = percentFormat.format(rule.percentOfNightlyPrice ?? 0);
    return rule.capPerPersonPerNight != null
      ? t('touristTaxRules.percentWithCap', { percent, cap: formatCurrency(rule.capPerPersonPerNight) })
      : t('touristTaxRules.percent', { percent });
  }
  return t('touristTaxRules.perPersonPerNight', { amount: formatCurrency(rule.ratePerPersonPerNight) });
}

/** Compact amount for tables: "6,00 €" or "10,5% (max 7,00 €)". */
export function touristTaxAmountShort(rule: TouristTaxRateRule, t: TranslateFn): string {
  if (rule.calculationMethod !== 'PercentOfNightlyPrice') return formatCurrency(rule.ratePerPersonPerNight);
  const percent = percentFormat.format(rule.percentOfNightlyPrice ?? 0);
  return rule.capPerPersonPerNight != null
    ? t('touristTaxRules.percentShortWithCap', { percent, cap: formatCurrency(rule.capPerPersonPerNight) })
    : `${percent}%`;
}

/** Details of a rate other than the amount: cap of nights, exemptions, reduced band, season. */
export function touristTaxRuleDetails(rule: TouristTaxRateRule, t: TranslateFn): string[] {
  const details: string[] = [];
  if (rule.maxNights != null) details.push(t('touristTaxRules.maxNights', { count: rule.maxNights }));
  if (rule.minimumAge > 0) details.push(t('touristTaxRules.exemptUnder', { count: rule.minimumAge }));
  if (rule.reducedRateMaxAge != null && rule.reducedRatePerPersonPerNight != null) {
    details.push(
      t('touristTaxRules.reduced', {
        amount: formatCurrency(rule.reducedRatePerPersonPerNight),
        from: rule.minimumAge,
        to: rule.reducedRateMaxAge,
      }),
    );
  }
  if (rule.seasonStart && rule.seasonEnd) {
    details.push(t('touristTaxRules.season', { from: seasonDay(rule.seasonStart), to: seasonDay(rule.seasonEnd) }));
  }
  return details;
}

/** True when the amount depends on the age of the minors (mirror of the backend `AgeMatters`). */
export function touristTaxAgeRulesApply(rules: readonly TouristTaxRateRule[]): boolean {
  return rules.some(
    (rule) =>
      (rule.minimumAge > 0 && rule.minimumAge <= MINOR_MAX_AGE) ||
      (rule.reducedRateMaxAge != null && rule.reducedRatePerPersonPerNight != null),
  );
}

/** Keeps one age slot per child: existing ages are kept, new children start without an age. */
export function resizeChildrenAges(ages: readonly (number | null)[], children: number): (number | null)[] {
  const count = Number.isInteger(children) && children > 0 ? children : 0;
  return Array.from({ length: count }, (_, index) => ages[index] ?? null);
}

/** The ages when every child has one, otherwise undefined (the backend then asks for them if needed). */
export function completeChildrenAges(ages: readonly (number | null)[]): number[] | undefined {
  if (ages.length === 0 || ages.some((age) => age === null)) return undefined;
  return ages as number[];
}
