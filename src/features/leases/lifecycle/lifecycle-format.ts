import type { TFunction } from 'i18next';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { formatDate } from '@/lib/utils';
import type { LeaseDetail } from '@/types';

/** Who the lease is with and where: every window of the actions says it first ("Giulia Verdi · Casa Trastevere"). */
export type LeaseSubject = { tenant: string; property: string };

/** A day before this is not a day a lease can end on: it is the value of a column that was never written (a row of an old server). */
const FIRST_REAL_DAY = '1900-01-01';

/**
 * The last day of the period the lease is in (`currentTermEndDate`, LR-14), as the API wrote it. The end the contract states (`endDate`)
 * stands in for it when the answer does not carry it, or carries the starting value of the column (`0001-01-01`, a row written by a
 * server that did not know it and not repaired by the hourly job yet): better the end of the first period than a lease that ends in the
 * year 1.
 */
export function leaseTermEnd(lease: Pick<LeaseDetail, 'currentTermEndDate' | 'endDate'>): string {
  const current = lease.currentTermEndDate;
  return current && parseStayDate(current) >= FIRST_REAL_DAY ? current : lease.endDate;
}

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

/**
 * A lease signed by every party whose first day has not come (LR-TERM): there is nothing to end early, and only a consensual resolution
 * cancels it. `today` is the Rome calendar day (`yyyy-MM-dd`).
 */
export function leaseNotBegun(lease: Pick<LeaseDetail, 'status' | 'startDate'>, today: string): boolean {
  const start = parseStayDate(lease.startDate);
  return IN_FORCE_STATUSES.includes(lease.status) && start !== '' && start > today;
}

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
