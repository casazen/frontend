import type { TFunction } from 'i18next';
import { formatStayDate } from '@/lib/stay-dates';
import {
  GUEST_REGISTRATION_CERTAINTIES,
  GUEST_REGISTRATION_CHANNELS,
  GUEST_REGISTRATION_DEADLINE_KINDS,
  GUEST_REGISTRATION_MISSING_CODES,
  GUEST_REGISTRATION_OBLIGATIONS,
  GUEST_REGISTRATION_PRIVATE_RENTALS,
  GUEST_REGISTRATION_SUPPORTS,
  type GuestNotificationOverride,
  type GuestRegistrationCertainty,
  type GuestRegistrationMissingCode,
  type GuestRegistrationRegime,
} from '@/types/guest-registration.types';
import type { StatusTone } from '@/lib/status-dictionary';

/**
 * What the card of the regime says, as plain words (E29/F02/US02/T01, NF-125): the sentences are the ones of `guestRegistration.*`, chosen by the member of the
 * enum the server sent. A member this version does not know (the server is newer than the app) reads as «to check with the municipality or the police», never as
 * the raw value.
 */

const TO_VERIFY_KEY = 'guestRegistration.toVerify';

export const DUTY_ANSWERS: readonly GuestNotificationOverride[] = ['Required', 'NotRequired'];

function textOf(t: TFunction, group: string, known: readonly string[], value: unknown): string {
  return typeof value === 'string' && known.includes(value) ? t(`guestRegistration.${group}.${value}`) : t(TO_VERIFY_KEY);
}

function retentionText(t: TFunction, years: number | null): string {
  return typeof years === 'number' && Number.isFinite(years) && years > 0
    ? t('guestRegistration.retention.years', { count: Math.floor(years) })
    : t('guestRegistration.retention.none');
}

export interface RegimeFacts {
  obligation: string;
  deadline: string;
  deadlineNote: string | null;
  retention: string;
  channel: string;
  support: string;
}

export function regimeFacts(regime: GuestRegistrationRegime, t: TFunction): RegimeFacts {
  const note = typeof regime.deadlineNote === 'string' ? regime.deadlineNote.trim() : '';
  return {
    obligation: `${textOf(t, 'obligation', GUEST_REGISTRATION_OBLIGATIONS, regime.obligation)} ${textOf(t, 'privateRentals', GUEST_REGISTRATION_PRIVATE_RENTALS, regime.privateRentals)}`,
    deadline: textOf(t, 'deadline', GUEST_REGISTRATION_DEADLINE_KINDS, regime.deadlineKind),
    deadlineNote: note === '' ? null : note,
    retention: retentionText(t, regime.retentionYears),
    channel: textOf(t, 'channel', GUEST_REGISTRATION_CHANNELS, regime.channel),
    support: textOf(t, 'support', GUEST_REGISTRATION_SUPPORTS, regime.casaZenSupport),
  };
}

export interface CertaintyView {
  certainty: GuestRegistrationCertainty;
  tone: StatusTone;
  label: string;
  text: string;
}

export function certaintyView(regime: GuestRegistrationRegime, t: TFunction, language: string): CertaintyView {
  const certainty: GuestRegistrationCertainty = GUEST_REGISTRATION_CERTAINTIES.includes(regime.certainty) ? regime.certainty : 'Unverified';
  const date = formatStayDate(regime.verifiedOn, language) || '—';
  return {
    certainty,
    tone: certainty === 'Verified' ? 'success' : certainty === 'Partial' ? 'info' : 'neutral',
    label: t(`guestRegistration.certainty.${certainty}.label`),
    text: t(`guestRegistration.certainty.${certainty}.text`, { date }),
  };
}

export function missingCodesOf(reasons: readonly string[] | null | undefined): string[] {
  return Array.isArray(reasons) ? [...new Set(reasons.filter((reason) => typeof reason === 'string'))] : [];
}

export function isMissingCode(code: string): code is GuestRegistrationMissingCode {
  return (GUEST_REGISTRATION_MISSING_CODES as readonly string[]).includes(code);
}

export function isPlaceUnknown(missing: readonly string[]): boolean {
  const municipalityMissing: GuestRegistrationMissingCode = 'swiss_municipality_missing';
  return missing.includes(municipalityMissing);
}

export function missingTextKey(code: string): string {
  return isMissingCode(code) ? `guestRegistration.missing.${code}` : 'guestRegistration.missing.unknown';
}

export function portalLink(url: string | null | undefined): { href: string; host: string } | null {
  if (typeof url !== 'string' || url.trim() === '') return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' ? { href: parsed.href, host: parsed.host } : null;
  } catch {
    return null;
  }
}

export function isTicinoRegime(regime: Pick<GuestRegistrationRegime, 'cantonCode'> | null | undefined): boolean {
  return regime?.cantonCode === 'TI';
}
