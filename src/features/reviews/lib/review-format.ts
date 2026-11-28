import { formatStayDate } from '@/lib/stay-dates';

export function formatStayMonth(stayMonth: string, locale: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(stayMonth);
  return match ? formatStayDate(`${match[1]}-${match[2]}-01`, locale, { month: 'long', year: 'numeric' }) : '';
}

export function formatAverage(average: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(average);
}
