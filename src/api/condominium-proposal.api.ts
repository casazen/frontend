import { isAxiosError } from 'axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { CondominiumAcceptedProposal, CondominiumManualProposal, CondominiumProposal } from '@/types/condominium-proposal.types';
import { ApiClient } from './client';

/**
 * Condominium expenses for the contract wizard.
 * `GET /long-rent/properties/:propertyId/condominium-proposal` proposes the amount when the property
 * already has a fiscal year. `POST` the same path accepts that amount, stores a hand-typed amount
 * (settled at consuntivo), or calculates one from the previous-year consuntivo and the new-year preventivo.
 * A missing resource (404) is an empty proposal: the wizard asks for the files or a hand-typed amount.
 */
export function condominiumProposalPath(propertyId: string): string {
  return `/long-rent/properties/${encodeURIComponent(propertyId)}/condominium-proposal`;
}

const EMPTY: CondominiumProposal = { state: 'empty', fiscalYearLabel: null, amount: null, currency: 'EUR' };

export const condominiumProposalApi = {
  get: async (propertyId: string): Promise<CondominiumProposal> => {
    try {
      return parseProposal(await ApiClient.get<unknown>(condominiumProposalPath(propertyId)));
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return EMPTY;
      throw error;
    }
  },

  accept: async (propertyId: string, body: CondominiumAcceptedProposal | CondominiumManualProposal): Promise<CondominiumProposal> =>
    parseProposal(await ApiClient.post<unknown>(condominiumProposalPath(propertyId), body)),

  /**
   * Previous-year consuntivo and new-year preventivo. The answer is the amount calculated from those files.
   */
  calculateFromFiles: async (propertyId: string, leaseId: string, consuntivo: File, preventivo: File): Promise<CondominiumProposal> => {
    const form = new FormData();
    form.append('leaseId', leaseId);
    form.append('consuntivo', consuntivo);
    form.append('preventivo', preventivo);
    return parseProposal(
      await ApiClient.post<unknown>(condominiumProposalPath(propertyId), form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseProposal(data: unknown): CondominiumProposal {
  const path = '/long-rent/properties/:propertyId/condominium-proposal';
  if (!isRecord(data)) throw new UnexpectedApiResponseError(path);
  const state = data.state;
  const currency = data.currency;
  if ((state !== 'ready' && state !== 'empty') || currency !== 'EUR') throw new UnexpectedApiResponseError(path);
  const label = data.fiscalYearLabel;
  const fiscalYearLabel = typeof label === 'string' && label.trim() !== '' ? label : null;
  const amount = data.amount;
  if (state === 'empty') {
    if (amount !== null && amount !== undefined) throw new UnexpectedApiResponseError(path);
    return { state, fiscalYearLabel, amount: null, currency: 'EUR' };
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) throw new UnexpectedApiResponseError(path);
  return { state, fiscalYearLabel, amount, currency: 'EUR' };
}
