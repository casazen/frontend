import { formatRomeDateTime, formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';

function localeOf(language: string): string {
  return language.startsWith('en') ? 'en-GB' : 'it-IT';
}

export function formatMoney(amount: number, language: string): string {
  return formatCurrency(amount, 'EUR', localeOf(language));
}

export function formatDecimal(value: number, language: string): string {
  return new Intl.NumberFormat(localeOf(language), { maximumFractionDigits: 1 }).format(value);
}

export function formatDay(value: string | null | undefined, language: string): string | null {
  const day = parseStayDate(value);
  return day ? formatStayDate(day, language, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
}

export function formatInstantDay(value: string | null | undefined, language: string): string | null {
  if (!value) return null;
  const text = formatRomeDateTime(value, language, { day: 'numeric', month: 'short', year: 'numeric' });
  return text || null;
}
