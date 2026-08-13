import { ApiClient } from './client';

export type StrFiscalRegime =
  | 'CedolareSecca21'
  | 'CedolareSecca26'
  | 'RegimeOrdinario'
  | 'RegimeForfettario';

export interface FiscalPropertyRow {
  propertyId: string;
  name: string;
  recommendedRegime: StrFiscalRegime | null;
  assignedRegime: StrFiscalRegime | null;
  isPrimaryForCedolare: boolean;
}

export interface FiscalRegimeSnapshot {
  taxYear: number;
  strPropertyCount: number;
  requiresPartitaIva: boolean;
  hasPartitaIva: boolean;
  disclaimer: string;
  properties: FiscalPropertyRow[];
}

export interface FiscalTaxProfile {
  hasPartitaIva: boolean;
  partitaIvaNumber: string | null;
  fiscalCode: string | null;
  fiscalDataRetentionUntil: string | null;
}

export interface AnnualIncomeReport {
  taxYear: number;
  packLabel: string;
  disclaimer: string;
  properties: Array<{
    propertyId: string;
    name: string;
    regime: StrFiscalRegime | null;
    grossIncome: number;
    withholding: number;
    net: number;
  }>;
  totals: { grossIncome: number; withholding: number; net: number };
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
  }>;
}

export const fiscalApi = {
  getRegime: (taxYear: number) =>
    ApiClient.get<FiscalRegimeSnapshot>('/fiscal/regime', { taxYear }),
  assignRegime: (propertyId: string, body: { taxYear: number; regime: StrFiscalRegime; isPrimaryForCedolare?: boolean }) =>
    ApiClient.put<FiscalPropertyRow>(`/fiscal/properties/${propertyId}/regime`, body),
  getTaxProfile: () => ApiClient.get<FiscalTaxProfile>('/fiscal/tax-profile'),
  putTaxProfile: (body: { hasPartitaIva: boolean; partitaIvaNumber?: string | null; fiscalCode?: string | null }) =>
    ApiClient.put<FiscalTaxProfile>('/fiscal/tax-profile', body),
  getAnnual: (taxYear: number) =>
    ApiClient.get<AnnualIncomeReport>(`/fiscal/reports/annual/${taxYear}`),
  getWithholding: (taxYear: number) =>
    ApiClient.get<WithholdingReport>(`/fiscal/reports/withholding/${taxYear}`),
  simulate: (taxYear: number, hypotheticalStrCount?: number) =>
    ApiClient.post<{ recommendedForCount: string; requiresPartitaIva: boolean; disclaimer: string }>(
      '/fiscal/simulate',
      { taxYear, hypotheticalStrCount },
    ),
  downloadAnnual: async (taxYear: number, format: 'csv' | 'pdf') => {
    const { default: axios } = await import('@/lib/axios');
    const res = await axios.get(`/fiscal/reports/annual/${taxYear}`, {
      params: { format },
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  downloadWithholding: async (taxYear: number, format: 'csv' | 'pdf') => {
    const { default: axios } = await import('@/lib/axios');
    const res = await axios.get(`/fiscal/reports/withholding/${taxYear}`, {
      params: { format },
      responseType: 'blob',
    });
    return res.data as Blob;
  },
};
