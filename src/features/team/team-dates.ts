import { formatRomeDateTime } from '@/lib/stay-dates';

const DAY = { day: 'numeric', month: 'long', year: 'numeric' } as const;

function asInstant(when: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(when) ? when : `${when}Z`;
}

export function dayOf(when: string, language: string): string {
  return formatRomeDateTime(asInstant(when), language, DAY);
}

export function daysSince(when: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(asInstant(when)).getTime()) / 86_400_000));
}
