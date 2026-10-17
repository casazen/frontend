import { formatRomeDateTime } from '@/lib/stay-dates';

const DAY = { day: 'numeric', month: 'long', year: 'numeric' } as const;

/** The backend sends UTC instants; one without a zone mark would be read as local time. */
function asInstant(when: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(when) ? when : `${when}Z`;
}

/** «17 ottobre 2026»: the day an instant of the backend falls on, in Rome. */
export function dayOf(when: string, language: string): string {
  return formatRomeDateTime(asInstant(when), language, DAY);
}
