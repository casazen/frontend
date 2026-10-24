import type { TFunction } from 'i18next';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { formatDate } from '@/lib/utils';
import type { LeaseDetail } from '@/types';

/** Who the lease is with and where: every window of the actions says it first ("Giulia Verdi · Casa Trastevere"). */
export type LeaseSubject = { tenant: string; property: string };

/** "30 settembre 2030" from a day as the API writes it (`2030-09-30`, `2030-09-30T00:00:00Z`); empty when it is not a day. */
export function longDay(value: string | null | undefined, language: string): string {
  const day = parseStayDate(value);
  return day ? formatStayDate(day, language) : '';
}

/** "30/09/2030", like the other dates of the sheet; empty when it is not a day. */
function shortDay(value: string | null | undefined): string {
  const day = parseStayDate(value);
  return day ? formatDate(day) : '';
}

/** The statuses of a lease signed by all its parties (`LeaseRenewal.InForceStatuses` of the server): the ones a lease renews in. */
const IN_FORCE_STATUSES: readonly string[] = ['Signed', 'RegistrationPending', 'SentToProvider', 'Registered'];

export interface LeaseTermFact {
  key: 'notice' | 'terminated' | 'renews';
  label: string;
  value: string;
}

/**
 * What the sheet says of the end of a lease besides the date (LR-14): the notice that was given and by whom, the day it ended early, or
 * that it renews by itself if nobody gives notice. Nothing is said that the server did not send, and no number of months or of notice
 * is written here: the figures of the law are the legal's to confirm (LR-D29), the interface only says what happens.
 */
export function leaseTermFacts(lease: LeaseDetail, t: TFunction): LeaseTermFact[] {
  const facts: LeaseTermFact[] = [];

  const noticeDay = shortDay(lease.noticeOn);
  if (noticeDay) {
    facts.push({
      key: 'notice',
      label: t('leaseLifecycle.facts.noticeLabel'),
      value: t(`leaseLifecycle.facts.noticeFrom.${lease.noticeFrom ?? 'unknown'}`, { date: noticeDay }),
    });
  }

  const terminatedDay = shortDay(lease.terminatedOn);
  if (terminatedDay) {
    facts.push({ key: 'terminated', label: t('leaseLifecycle.facts.terminatedLabel'), value: terminatedDay });
  } else if (!noticeDay && IN_FORCE_STATUSES.includes(lease.status) && (lease.renewalMonths ?? 0) > 0) {
    facts.push({ key: 'renews', label: t('leaseLifecycle.facts.renewsLabel'), value: t('leaseLifecycle.facts.renewsValue') });
  }

  return facts;
}
