import { formatStayDate } from '@/lib/stay-dates';

/** The month of a stay (`yyyy-MM`, as the API sends it) the way the reader's language writes it ("giugno 2026"); empty if it is not a month. */
export function formatStayMonth(stayMonth: string, locale: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(stayMonth);
  return match ? formatStayDate(`${match[1]}-${match[2]}-01`, locale, { month: 'long', year: 'numeric' }) : '';
}

/** The average of the marks with one decimal and the separator of the language ("4,8" / "4.8"). */
export function formatAverage(average: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(average);
}
