import { ApiClient } from './client';
import axios from '@/lib/axios';
import { saveBlobAs } from '@/lib/file-download';

export const CONDO_KEY = 'condominium-accounting';
export const CONDO_BASE = '/long-rent/condominiums';
export interface CondoPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
}
export interface CondoBook {
  id: string;
  name: string;
  fiscalStartMonth: number;
  periods: CondoPeriod[];
}
export interface CondoProperty {
  propertyId: string;
  propertyName: string;
  books: CondoBook[];
}
export interface CondoReport {
  condominiumName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  ordinary: number;
  extraordinary: number;
  prior: number;
  finalAmount: number | null;
  paid: number;
  stillToPay: number;
  settlement: { direction: string; amount: number } | null;
  installments: {
    id: string;
    label: string;
    dueDate: string;
    ordinary: number;
    prior: number;
    extraordinary: number;
    due: number;
    paid: number;
    remaining: number;
  }[];
  payments: {
    id: string;
    paidOn: string;
    method: string | null;
    amount: number;
    covers: string;
  }[];
}
export const condominiumAccountingApi = {
  properties: () => ApiClient.get<CondoProperty[]>(`${CONDO_BASE}/properties`),
  report: (book: string, period: string) =>
    ApiClient.get<CondoReport>(
      `${CONDO_BASE}/${book}/periods/${period}/report`,
    ),
  pdf: async (book: string, period: string, kind: 'paid' | 'unpaid') => {
    const { data } = await axios.get<Blob>(
      `${CONDO_BASE}/${book}/periods/${period}/report/${kind}.pdf`,
      { responseType: 'blob' },
    );
    saveBlobAs(data, `spese-${kind === 'paid' ? 'pagate' : 'da-pagare'}.pdf`);
  },
};
