import i18n from '@/i18n/config';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import { todayInRome } from '@/lib/stay-dates';

const ROME_TIME_ZONE = 'Europe/Rome';

export function getAlloggiatiStatusLabel(status: AlloggiatiWebStatus): string {
  return i18n.t(`alloggiati.statusLabel.${status}`);
}

export function isAlloggiatiSent(status: AlloggiatiWebStatus): boolean {
  return status === 'Inviato' || status === 'InviatoManualmente';
}

export function isAlloggiatiNotDue(status: AlloggiatiWebStatus): boolean {
  return status === 'NotDue';
}

export function canMarkAlloggiatiSentManually(status: AlloggiatiWebStatus): boolean {
  return status === 'DaInviareManualmente' || status === 'Errore' || status === 'Rifiutato';
}

export const ALLOGGIATI_ATTENTION_CLASS = 'border-transparent bg-orange-500 text-white hover:bg-orange-600';

export function todayInRomeIso(now: Date = new Date()): string {
  return todayInRome(now);
}

export function isoDatePart(value: string): string {
  return value.slice(0, 10);
}

/** `dd/mm/yyyy`, the date format of the Alloggiati record, of a date-only value. */
export function formatRecordDate(value: string): string {
  const [year, month, day] = isoDatePart(value).split('-');
  return `${day}/${month}/${year}`;
}

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
