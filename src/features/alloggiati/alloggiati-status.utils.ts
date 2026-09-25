import i18n from '@/i18n/config';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import { todayInRome } from '@/lib/stay-dates';

const ROME_TIME_ZONE = 'Europe/Rome';

/** Returns an i18n-translated label for an Alloggiati Web report status. */
export function getAlloggiatiStatusLabel(status: AlloggiatiWebStatus): string {
  return i18n.t(`alloggiati.statusLabel.${status}`);
}

/** Sent with a receipt, or declared sent by the host: nothing left to do. */
export function isAlloggiatiSent(status: AlloggiatiWebStatus): boolean {
  return status === 'Inviato' || status === 'InviatoManualmente';
}

/**
 * The host can declare a manual submission once the arrival day has come (the portal accepts only today or
 * yesterday as arrival date) and until the communication is sent.
 */
export function canMarkAlloggiatiSentManually(status: AlloggiatiWebStatus): boolean {
  return status === 'DaInviareManualmente' || status === 'Errore' || status === 'Rifiutato';
}

/** Orange: the host must act. Never the green of a real receipt. */
export const ALLOGGIATI_ATTENTION_CLASS = 'border-transparent bg-orange-500 text-white hover:bg-orange-600';

/** `yyyy-MM-dd` of today in Europe/Rome (the shared helper of `@/lib/stay-dates`). */
export function todayInRomeIso(now: Date = new Date()): string {
  return todayInRome(now);
}

/** Date part (`yyyy-MM-dd`) of an API date-only value (midnight UTC), with no time-zone shift. */
export function isoDatePart(value: string): string {
  return value.slice(0, 10);
}

/** `dd/mm/yyyy`, the date format of the Alloggiati record, of a date-only value. */
export function formatRecordDate(value: string): string {
  const [year, month, day] = isoDatePart(value).split('-');
  return `${day}/${month}/${year}`;
}

/** An instant (e.g. the deadline) as date and time in Europe/Rome. */
export function formatRomeDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: ROME_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
