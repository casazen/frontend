import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import { ApiClient } from './client';

export type StrFiscalRegime =
  | 'CedolareSecca21'
  | 'CedolareSecca26'
  | 'RegimeOrdinario'
  | 'RegimeForfettario'
  | 'IrpefOrdinaria';

/** Every regime of the backend model, in the order the dashboard offers them. */
export const STR_FISCAL_REGIMES: readonly StrFiscalRegime[] = [
  'CedolareSecca21',
  'CedolareSecca26',
  'IrpefOrdinaria',
  'RegimeOrdinario',
  'RegimeForfettario',
];

/** Stable codes of `FiscalPropertyRow.taxNote` and of the report lines (backend `FiscalTaxNotes`). */
export type FiscalTaxNote =
  | 'irpef_ordinaria_not_computed'
  | 'short_stay_threshold_exceeded'
  | 'regime_not_assigned'
  | 'impresa_not_computed';

export interface FiscalPropertyRow {
  propertyId: string;
  name: string;
  recommendedRegime: StrFiscalRegime | null;
  assignedRegime: StrFiscalRegime | null;
  isPrimaryForCedolare: boolean;
  /** Short-term stays in the tax year: the apartment counts toward its taxpayer's threshold. */
  shortStayInTaxYear: boolean;
  /** Index of the property's taxpayer in `FiscalRegimeSnapshot.taxpayers`. */
  taxpayerIndex: number;
  /** Rate of the assigned cedolare regime (fraction, from backend configuration). */
  cedolareRate: number | null;
  taxNote: FiscalTaxNote | null;
  /** Regimes the host can assign now (threshold and partita IVA rules of the backend). */
  availableRegimes: StrFiscalRegime[];
}

/** One taxpayer (titolare fiscale): the short-rental threshold is per taxpayer, not per org. */
export interface FiscalTaxpayerSummary {
  index: number;
  fiscalCodeMasked: string | null;
  isOrgTaxProfile: boolean;
  shortStayApartmentCount: number;
  thresholdExceeded: boolean;
  reducedRatePropertyId: string | null;
}

export interface FiscalRegimeSnapshot {
  taxYear: number;
  strPropertyCount: number;
  /** At least one taxpayer is over the threshold (business activity presumed). */
  requiresPartitaIva: boolean;
  hasPartitaIva: boolean;
  disclaimer: string;
  properties: FiscalPropertyRow[];
  maxShortStayApartmentsPerTaxpayer: number;
  thresholdSource: string;
  taxpayers: FiscalTaxpayerSummary[];
}

export interface FiscalTaxProfile {
  hasPartitaIva: boolean;
  partitaIvaNumber: string | null;
  fiscalCode: string | null;
  fiscalDataRetentionUntil: string | null;
}

/** Partial update of the tax profile: only the fields sent change (`fiscalCode: ''` clears it). */
export interface FiscalTaxProfileUpdate {
  hasPartitaIva?: boolean;
  partitaIvaNumber?: string;
  fiscalCode?: string;
}

/** Report period: calendar dates `YYYY-MM-DD`, both included. */
export interface FiscalReportPeriod {
  from: string;
  to: string;
}

/** Rates and legal sources applied by the reports (backend configuration). */
export interface FiscalReportRules {
  cedolareRate: number;
  cedolareReducedRate: number;
  cedolareSource: string;
  otaWithholdingRate: number;
  otaWithholdingSource: string;
  maxApartmentsPerTaxpayer: number;
  thresholdSource: string;
}

export interface AnnualIncomeLine {
  propertyId: string;
  name: string;
  regime: StrFiscalRegime | null;
  /** Payments completed in the period, refunds deducted (tourist tax included). */
  grossIncome: number;
  withholding: number;
  net: number;
  /** Tourist tax included in `grossIncome` (amount recorded on the stays). */
  touristTax: number;
  /** Gross rent: `grossIncome - touristTax`. */
  rentalIncome: number;
  /** Not recorded in CasaZen: always null. */
  commissions: number | null;
  /** Cedolare secca only; null when the tax is not estimated (`taxNote` says why). */
  taxableIncome: number | null;
  taxRate: number | null;
  estimatedTax: number | null;
  taxNote: FiscalTaxNote | null;
  taxpayerIndex: number | null;
}

export interface AnnualTaxpayerTotals {
  index: number;
  fiscalCodeMasked: string | null;
  isOrgTaxProfile: boolean;
  thresholdExceeded: boolean;
  properties: number;
  rentalIncome: number;
  withholding: number;
  estimatedTax: number;
}

export interface AnnualIncomeReport {
  taxYear: number;
  packLabel: string;
  disclaimer: string;
  properties: AnnualIncomeLine[];
  totals: {
    grossIncome: number;
    withholding: number;
    net: number;
    touristTax: number;
    rentalIncome: number;
    taxableIncome: number;
    estimatedTax: number;
    linesWithoutEstimate: number;
  };
  period: FiscalReportPeriod;
  orgName: string;
  generatedOn: string;
  taxpayers: AnnualTaxpayerTotals[];
  rules: FiscalReportRules;
}

export interface WithholdingReport {
  taxYear: number;
  packLabel: string;
  byOta: Array<{ source: string; gross: number; withholding: number; net: number; payoutCount: number }>;
  lines: Array<{
    paymentId: string;
    propertyId: string;
    source: string;
    paidAt: string;
    gross: number;
    withholding: number;
    net: number;
    propertyName: string;
    bookingCode: string;
    /** Payment date in Europe/Rome (`YYYY-MM-DD`). */
    paidOn: string;
    withholdingSource: 'None' | 'AutoOta' | 'Manual';
  }>;
  period: FiscalReportPeriod;
  disclaimer: string;
  orgName: string;
  generatedOn: string;
  totals: { gross: number; withholding: number; net: number; payoutCount: number };
  rules: FiscalReportRules;
}

export interface TouristTaxReport {
  period: FiscalReportPeriod;
  disclaimer: string;
  orgName: string;
  generatedOn: string;
  rows: Array<{
    comune: string;
    year: number;
    month: number;
    stays: number;
    nights: number;
    guests: number;
    amount: number;
    staysWithoutAmount: number;
  }>;
  byComune: Array<{
    comune: string;
    stays: number;
    nights: number;
    guests: number;
    amount: number;
    staysWithoutAmount: number;
  }>;
  stays: Array<{
    bookingId: string;
    bookingCode: string;
    propertyId: string;
    propertyName: string;
    comune: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    guests: number;
    source: string;
    amount: number;
  }>;
  totals: { stays: number; nights: number; guests: number; amount: number; staysWithoutAmount: number };
}

export type FiscalReportKind = 'annual' | 'withholding' | 'touristTax';
export type FiscalExportFormat = 'csv' | 'pdf';

/** Backend path of a report; the summary and the withholding are per tax year. */
function reportPath(kind: FiscalReportKind, taxYear: number): string {
  switch (kind) {
    case 'annual':
      return `/fiscal/reports/annual/${taxYear}`;
    case 'withholding':
      return `/fiscal/reports/withholding/${taxYear}`;
    case 'touristTax':
      return '/fiscal/reports/tourist-tax';
  }
}

export const fiscalApi = {
  getRegime: (taxYear: number) =>
    ApiClient.get<FiscalRegimeSnapshot>('/fiscal/regime', { taxYear }),
  assignRegime: (propertyId: string, body: { taxYear: number; regime: StrFiscalRegime; isPrimaryForCedolare?: boolean }) =>
    ApiClient.put<FiscalPropertyRow>(`/fiscal/properties/${propertyId}/regime`, body),
  getTaxProfile: () => ApiClient.get<FiscalTaxProfile>('/fiscal/tax-profile'),
  putTaxProfile: (body: FiscalTaxProfileUpdate) => ApiClient.put<FiscalTaxProfile>('/fiscal/tax-profile', body),
  getAnnual: (taxYear: number, period: FiscalReportPeriod) =>
    ApiClient.get<AnnualIncomeReport>(reportPath('annual', taxYear), period),
  getWithholding: (taxYear: number, period: FiscalReportPeriod) =>
    ApiClient.get<WithholdingReport>(reportPath('withholding', taxYear), period),
  getTouristTax: (period: FiscalReportPeriod) =>
    ApiClient.get<TouristTaxReport>(reportPath('touristTax', 0), period),
  simulate: (taxYear: number, hypotheticalStrCount?: number) =>
    ApiClient.post<{ recommendedForCount: string; requiresPartitaIva: boolean; disclaimer: string }>(
      '/fiscal/simulate',
      { taxYear, hypotheticalStrCount },
    ),
  /** CSV or PDF of a report; a problem body (JSON Blob) is parsed so `getProblemMessage` can read it. */
  downloadReport: async (
    kind: FiscalReportKind,
    taxYear: number,
    period: FiscalReportPeriod,
    format: FiscalExportFormat,
  ): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(reportPath(kind, taxYear), {
        params: { ...period, format },
        responseType: 'blob',
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
