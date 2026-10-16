import { useTranslation } from 'react-i18next';
import { getArea } from '@/config/areas';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import type { RentalMode } from '@/types/property.types';
import { areaOfMode } from './paths';

/** A stay date as the language of the page writes it ("1 dicembre 2026"); an empty text for what is not a date. */
export function useDayLabel() {
  const { i18n } = useTranslation();
  return (value: string) => formatStayDate(parseStayDate(value), i18n.language);
}

/**
 * A span of days, "dal 28 settembre al 3 ottobre 2026": the year is written where it tells the days apart, so a lease from
 * December 2025 to December 2026 does not read "dal 1 dicembre al 1 dicembre".
 */
export function useRangeLabel() {
  const { t, i18n } = useTranslation();
  return (start: string, end: string) => {
    const from = parseStayDate(start);
    const to = parseStayDate(end);
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return t('propertyMode.checks.range', {
      start: formatStayDate(from, i18n.language, sameYear ? { day: 'numeric', month: 'long' } : undefined),
      end: formatStayDate(to, i18n.language),
    });
  };
}

/** Name of a mode as the sections are called: "Affitti brevi", "Affitti lunghi". */
export function useModeName() {
  const { t } = useTranslation();
  return (mode: RentalMode) => t(getArea(areaOfMode(mode)).nameKey);
}
