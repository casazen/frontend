import type { TFunction } from 'i18next';
import type { SeasonalPricingRules, SeasonalSuggestion } from '@/types';

export const MIN_MULTIPLIER = 0.1;
export const MAX_MULTIPLIER = 5;

export function parseMultiplier(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < MIN_MULTIPLIER || parsed > MAX_MULTIPLIER) return null;
  return Math.round(parsed * 100) / 100;
}

export function formatMultiplier(multiplier: number, language: string): string {
  return `×${new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(multiplier)}`;
}

export function percentChange(multiplier: number, language: string): string {
  const percent = Math.round((multiplier - 1) * 100);
  const formatted = new Intl.NumberFormat(language, { signDisplay: 'exceptZero' }).format(percent);
  return `${formatted}%`;
}

export function monthLabel(month: number, language: string): string {
  return new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

function monthList(months: number[], language: string): string {
  const names = months.map((month) =>
    new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1))),
  );
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(names);
}

function changeWords(percent: number, t: TFunction): string {
  return percent > 0 ? t('pricing.summary.up', { percent }) : t('pricing.summary.down', { percent: -percent });
}

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
