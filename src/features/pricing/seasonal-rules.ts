import type { TFunction } from 'i18next';
import type { SeasonalPricingRules, SeasonalSuggestion } from '@/types';

/** Bounds of a rule multiplier, same as the backend (`SeasonalPricingRules.MinMultiplier/MaxMultiplier`). */
export const MIN_MULTIPLIER = 0.1;
export const MAX_MULTIPLIER = 5;

/** Multiplier typed by the host ("1,3" or "1.3"), or null when it is not a number within the bounds. */
export function parseMultiplier(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < MIN_MULTIPLIER || parsed > MAX_MULTIPLIER) return null;
  return Math.round(parsed * 100) / 100;
}

/** "×1,30" in the user's language. */
export function formatMultiplier(multiplier: number, language: string): string {
  return `×${new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(multiplier)}`;
}

/** "+30%" / "-20%" / "0%" for a multiplier. */
export function percentChange(multiplier: number, language: string): string {
  const percent = Math.round((multiplier - 1) * 100);
  const formatted = new Intl.NumberFormat(language, { signDisplay: 'exceptZero' }).format(percent);
  return `${formatted}%`;
}

/** Short month name (Intl, user's language): 1 → "gen" / "Jan". */
export function monthLabel(month: number, language: string): string {
  return new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

/** Month names of a list, in the user's language: [6, 7, 8] → "giugno, luglio e agosto". */
function monthList(months: number[], language: string): string {
  const names = months.map((month) =>
    new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1))),
  );
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(names);
}

/** What the rules do to the price, in words: "sale del 30%", "scende del 20%". Only for a multiplier that changes the price. */
function changeWords(percent: number, t: TFunction): string {
  return percent > 0 ? t('pricing.summary.up', { percent }) : t('pricing.summary.down', { percent: -percent });
}

/**
 * The rules the host set, one sentence each, in plain words: "Alta stagione (giugno, luglio e agosto): il prezzo sale del 30%".
 * A rule that is switched off, has no months or does not change the price is not told; nothing at all when none is left.
 */
export function ruleSentences(rules: SeasonalPricingRules, t: TFunction, language: string): string[] {
  const sentences: string[] = [];

  if (rules.includeSeasonality) {
    for (const season of ['high', 'low'] as const) {
      const months = season === 'high' ? rules.highSeasonMonths : rules.lowSeasonMonths;
      const percent = Math.round(((season === 'high' ? rules.highSeasonMultiplier : rules.lowSeasonMultiplier) - 1) * 100);
      if (months.length > 0 && percent !== 0) {
        sentences.push(
          t('pricing.summary.season', {
            season: t(`pricing.config.${season}Season`),
            months: monthList(months, language),
            change: changeWords(percent, t),
          }),
        );
      }
    }
  }

  if (rules.includePublicHolidays) {
    const percent = Math.round((rules.holidayMultiplier - 1) * 100);
    if (percent !== 0) sentences.push(t('pricing.summary.holidays', { change: changeWords(percent, t) }));
  }

  return sentences;
}

/** Rule applied to a suggestion, with its multiplier: "Alta stagione ×1,30", "Festivo: Pasqua ×1,50". */
export function ruleLabel(suggestion: SeasonalSuggestion, t: TFunction, language: string): string {
  const multiplier = formatMultiplier(suggestion.multiplier, language);
  switch (suggestion.rule) {
    case 'HighSeason':
      return t('pricing.rules.highSeason', { multiplier });
    case 'LowSeason':
      return t('pricing.rules.lowSeason', { multiplier });
    case 'Holiday':
      return t('pricing.rules.holiday', {
        multiplier,
        holiday: suggestion.holiday ? t(`pricing.holidays.${suggestion.holiday}`) : '',
      });
    default:
      return t('pricing.rules.none');
  }
}
