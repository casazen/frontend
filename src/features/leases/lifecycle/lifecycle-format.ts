import type { TFunction } from 'i18next';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { formatDate } from '@/lib/utils';
import type { LeaseDetail } from '@/types';

export type LeaseSubject = { tenant: string; property: string };

const FIRST_REAL_DAY = '1900-01-01';

export function leaseTermEnd(lease: Pick<LeaseDetail, 'currentTermEndDate' | 'endDate'>): string {
  const current = lease.currentTermEndDate;
  return current && parseStayDate(current) >= FIRST_REAL_DAY ? current : lease.endDate;
}

export function longDay(value: string | null | undefined, language: string): string {
  const day = parseStayDate(value);
  return day ? formatStayDate(day, language) : '';
}

function shortDay(value: string | null | undefined): string {
  const day = parseStayDate(value);
  return day ? formatDate(day) : '';
}

const IN_FORCE_STATUSES: readonly string[] = ['Signed', 'RegistrationPending', 'SentToProvider', 'Registered'];

export function leaseNotBegun(lease: Pick<LeaseDetail, 'status' | 'startDate'>, today: string): boolean {
  const start = parseStayDate(lease.startDate);
  return IN_FORCE_STATUSES.includes(lease.status) && start !== '' && start > today;
}

export interface LeaseTermFact {
  key: 'notice' | 'terminated' | 'renews';
  label: string;
  value: string;
}

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
