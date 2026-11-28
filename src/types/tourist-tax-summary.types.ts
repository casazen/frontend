export type TouristTaxSummaryStatus = 'NothingOwed' | 'ToPay' | 'Paid' | 'Overpaid';

export interface TouristTaxRemittance {
  id: string;
  comune: string;
  periodFrom: string;
  periodTo: string;
  amount: number;
  amountCents: number;
  paidOn: string;
  reference: string | null;
  notes: string | null;
  hasReceipt: boolean;
}

export interface TouristTaxComuneSummary {
  comune: string;
  stays: number;
  nights: number;
  guests: number;
  owed: number;
  owedCents: number;
  staysWithoutAmount: number;
  paid: number | null;
  paidCents: number | null;
  balance: number | null;
  balanceCents: number | null;
  status: TouristTaxSummaryStatus | null;
  remittances: TouristTaxRemittance[] | null;
}

interface TouristTaxSummaryTotals {
  stays: number;
  nights: number;
  guests: number;
  owed: number;
  owedCents: number;
  staysWithoutAmount: number;
  paid: number | null;
  paidCents: number | null;
  balance: number | null;
  balanceCents: number | null;
}

export interface TouristTaxSummary {
  title: string;
  basis: string;
  currency: string;
  paymentsHidden: boolean;
  period: { from: string; to: string };
  comuni: TouristTaxComuneSummary[];
  total: TouristTaxSummaryTotals;
}

export interface TouristTaxReasonCount {
  reason: string;
  stays: number;
  guests: number;
  guestNights: number;
}

export interface TouristTaxDeclarationComune {
  summary: TouristTaxComuneSummary;
  taxedStays: number;
  staysWithoutAmount: TouristTaxReasonCount[];
  /**
   * The exempt guests by reason, a count and never a guest. The reason can reveal a health condition (art. 9 GDPR), so the server decides who gets it: a caller who holds `guest.read` for the whole organization
   * gets the codes of the catalogue (`resident`, `health_care`...) or `erased`; everybody else gets `minor_age` (the age) and one `restricted` row that counts the other exempt guests.
   */
  exemptions: TouristTaxReasonCount[];
}

export interface TouristTaxDeclaration {
  year: number;
  currency: string;
  comuni: TouristTaxDeclarationComune[];
  total: TouristTaxSummaryTotals;
}

type TouristTaxAccountPeriod = 'Month' | 'Quarter';

export interface TouristTaxAgentAccountRow {
  comune: string;
  period: string;
  from: string;
  to: string;
  isYear: boolean;
  stays: number;
  nights: number;
  guests: number;
  collected: number;
  staysWithoutAmount: number;
  remitted: number;
  balance: number;
}

export interface TouristTaxAgentAccount {
  year: number;
  by: TouristTaxAccountPeriod;
  currency: string;
  rows: TouristTaxAgentAccountRow[];
  remittances: TouristTaxRemittance[];
  total: TouristTaxSummaryTotals;
}

export interface TicinoPropertyCount {
  propertyId: string;
  propertyName: string;
  address: string;
  city: string;
  municipalityCode: string | null;
  currency: string;
  stays: number;
  nights: number;
  taxedStays: number;
  taxedNights: number;
  untaxedStays: number;
  untaxedNights: number;
  staysWithoutDocument: number;
  nightsWithoutDocument: number;
  touristTax: number;
  cantonUnknown: boolean;
}

export interface TicinoYearlyCount {
  year: number;
  dueDate: string;
  cantonUnknownCount: number;
  properties: TicinoPropertyCount[];
}

export interface RecordTouristTaxRemittanceInput {
  comune: string;
  periodFrom: string;
  periodTo: string;
  paidAmount: string;
  paidOn: string;
  reference?: string;
  notes?: string;
  receipt?: File | null;
}
