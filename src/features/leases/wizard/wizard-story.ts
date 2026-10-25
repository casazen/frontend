import { isStayDate } from '@/lib/stay-dates';
import type { LongRentRules } from '@/types';
import { isBlankRow, periodEnd, termMonthsOf, type PartyRow, type WizardValues } from './wizard-model';

/**
 * What the review tells of the contract before the table of its data (LR-WIZ-1): who lets what to whom, from when and for how long, for
 * how much, and with which taxes. Pure: the sentences are written where the words are (the translations), from these facts. Nothing of
 * law is written here: the length of the first period is the server's (`rules.termMonths`), or the last day the contract states.
 */
export interface ContractStory {
  property: string;
  landlords: string[];
  tenants: string[];
  contractType: string;
  taxRegime: string;
  rent: number | null;
  deposit: number | null;
  start: string;
  /** The last day of the first period, when it is known: the one typed, or the one the type gives. */
  end: string;
  /** The months of the first period when the type gives them (a libero, a concordato); none when the contract states its own last day. */
  months: number | null;
}

/** The name of a person or a company as it is written in the contract. */
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
  // A contract that states its own last day (one already signed, a transitory one) is told with it; the others, with the term of their type.
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
