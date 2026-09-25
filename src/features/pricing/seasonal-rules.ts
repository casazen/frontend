import type { TFunction } from 'i18next';
import type { SeasonalSuggestion } from '@/types';

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
