import { isStayDate } from '@/lib/stay-dates';
import type { LongRentRules } from '@/types';
import { isBlankRow, periodEnd, termMonthsOf, type PartyRow, type WizardValues } from './wizard-model';

export interface ContractStory {
  property: string;
  landlords: string[];
  tenants: string[];
  contractType: string;
  taxRegime: string;
  rent: number | null;
  deposit: number | null;
  start: string;
  end: string;
  months: number | null;
}

export function partyName(row: Pick<PartyRow, 'firstName' | 'lastName'>): string {
  return [row.firstName, row.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

function amountOf(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function contractStory(values: WizardValues, rules: LongRentRules | undefined, propertyName: string): ContractStory {
  const named = (rows: PartyRow[]) => rows.filter((row) => !isBlankRow(row)).map(partyName).filter(Boolean);
  const rent = amountOf(values.monthlyRent);
  const start = isStayDate(values.startDate) ? values.startDate : '';
  const typedEnd = isStayDate(values.endDate) ? values.endDate : '';
  const statesEnd = values.contractType === 'Transitorio' || typedEnd !== '';
  const months = statesEnd ? null : termMonthsOf(rules, values.contractType);
  return {
    property: propertyName,
    landlords: named(values.landlords),
    tenants: named(values.tenants),
    contractType: values.contractType,
    taxRegime: values.taxRegime,
    rent: rent !== null && rent > 0 ? rent : null,
    deposit: amountOf(values.securityDeposit),
    start,
    end: typedEnd || (start && months !== null ? periodEnd(start, months) : ''),
    months,
  };
}
