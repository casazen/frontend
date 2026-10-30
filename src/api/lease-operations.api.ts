import { UnexpectedApiResponseError } from '@/lib/api-errors';
import axios from '@/lib/axios';
import { ApiClient } from './client';
import type {
  DisdettaLetterInput,
  IstatCalculationInput,
  IstatLetterInput,
  LeaseIstatCalculation,
  LeaseLetterKind,
  LeaseOperations,
  MarkLetterSentInput,
  OpzioneCedolareLetterInput,
  RenewalLetterInput,
  TenantWithdrawalInput,
} from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The address names of the letters (backend `LeaseLetterKinds.Slug`); never renamed. */
const LETTER_SLUGS: Readonly<Record<LeaseLetterKind, string>> = {
  Disdetta: 'disdetta',
  PresaAttoRecesso: 'presa-atto-recesso',
  Rinnovo: 'rinnovo',
  ConfermaEsigenza: 'conferma-esigenza',
  AggiornamentoIstat: 'aggiornamento-istat',
  OpzioneCedolare: 'opzione-cedolare',
};

/** What the server answers for a calculation of the ISTAT update: numbers, or it is not an answer. */
function expectIstatCalculation(data: unknown, url: string): LeaseIstatCalculation {
  if (!isRecord(data)) throw new UnexpectedApiResponseError(url);
  const { currentRent, foiPercent, sharePercent, appliedPercent, increase, newRent } = data;
  if (
    typeof currentRent !== 'number' ||
    typeof foiPercent !== 'number' ||
    typeof sharePercent !== 'number' ||
    typeof appliedPercent !== 'number' ||
    typeof increase !== 'number' ||
    typeof newRent !== 'number'
  ) {
    throw new UnexpectedApiResponseError(url);
  }
  return { currentRent, foiPercent, sharePercent, appliedPercent, increase, newRent };
}

/** What the server answers for the operations: anything else (an HTML fallback, an envelope) is not an answer. */
function expectOperations(data: unknown, url: string): LeaseOperations {
  if (
    !isRecord(data) ||
    !isRecord(data.disdetta) ||
    !isRecord(data.withdrawal) ||
    !Array.isArray(data.letters) ||
    !isRecord(data.renewal) ||
    !isRecord(data.transitoryConfirmation) ||
    !isRecord(data.istat) ||
    !isRecord(data.cedolareNotice)
  ) {
    throw new UnexpectedApiResponseError(url);
  }
  return data as unknown as LeaseOperations;
}

/**
 * The operations of a lease in force (LR-OPS-1): what the landlord can do about the end of the lease, the letters CasaZen prepares as drafts
 * (a PDF, watermarked until the product owner approves its text) and the record that a letter was sent. All of them need `lease.create` on the
 * property of the lease, and none writes to a tenant: the person signs and sends the letter. The rules and the error codes are in the runbook
 * of the backend (`lease-operations.md`).
 */
export const leaseOperationsApi = {
  /** What can be done now and the state of each letter. */
  get: async (id: string): Promise<LeaseOperations> =>
    expectOperations(await ApiClient.get<unknown>(`/leases/${id}/operations`), '/leases/:id/operations'),

  /**
   * The draft of the landlord's notice of non-renewal, as a PDF. At the first expiry the reason is required (422
   * `lease_disdetta_reason_required`). 409 `lease_not_in_force`, `lease_already_terminated`; 422 `lease_type_has_no_renewal`.
   */
  downloadDisdetta: async (id: string, input: DisdettaLetterInput): Promise<Blob> =>
    (await axios.post(`/leases/${id}/letters/${LETTER_SLUGS.Disdetta}`, input, { responseType: 'blob' })).data,

  /** The draft of the acknowledgement of the tenant's withdrawal, as a PDF, for a withdrawal received on `receivedOn`. */
  downloadPresaAttoRecesso: async (id: string, input: TenantWithdrawalInput): Promise<Blob> =>
    (await axios.post(`/leases/${id}/letters/${LETTER_SLUGS.PresaAttoRecesso}`, input, { responseType: 'blob' })).data,

  /**
   * The draft of the agreement of the two parties to renew or extend the lease, as a PDF, for the period from `startsOn` to `endsOn`.
   * 422 `lease_letter_not_applicable` (a type that does not renew), `lease_renewal_end_invalid`.
   */
  downloadRinnovo: async (id: string, input: RenewalLetterInput): Promise<Blob> =>
    (await axios.post(`/leases/${id}/letters/${LETTER_SLUGS.Rinnovo}`, input, { responseType: 'blob' })).data,

  /**
   * The draft of the confirmation that the need of a transitory lease goes on, from the landlord to the tenant, as a PDF. 422
   * `lease_letter_not_applicable` when the need is the tenant's or the lease is not a transitory one in force.
   */
  downloadConfermaEsigenza: async (id: string): Promise<Blob> =>
    (await axios.post(`/leases/${id}/letters/${LETTER_SLUGS.ConfermaEsigenza}`, {}, { responseType: 'blob' })).data,

  /**
   * The ISTAT update of the rent worked out by the server from the variation of the FOI index and the share the person typed. Nothing is
   * written and no external service is called. 422 `lease_istat_waived` (cedolare secca), `lease_istat_no_rent`, `lease_istat_percent_invalid`,
   * `lease_istat_no_increase`; 409 `lease_not_in_force`, `lease_already_terminated`.
   */
  calculateIstat: async (id: string, input: IstatCalculationInput): Promise<LeaseIstatCalculation> =>
    expectIstatCalculation(await ApiClient.post<unknown>(`/leases/${id}/istat/calculate`, input), '/leases/:id/istat/calculate'),

  /**
   * The draft of the request to update the rent, as a PDF, with the numbers of the calculation, from `effectiveFrom` (never in the past, not
   * after the period: 422 `lease_letter_effect_date_invalid`).
   */
  downloadAggiornamentoIstat: async (id: string, input: IstatLetterInput): Promise<Blob> =>
    (await axios.post(`/leases/${id}/letters/${LETTER_SLUGS.AggiornamentoIstat}`, input, { responseType: 'blob' })).data,

  /**
   * The draft of the communication to the tenant that the landlord has chosen the cedolare secca, with the renunciation of the updates of the
   * rent, as a PDF. 422 `lease_letter_not_applicable` when the lease is not under the cedolare secca.
   */
  downloadOpzioneCedolare: async (id: string, input: OpzioneCedolareLetterInput): Promise<Blob> =>
    (await axios.post(`/leases/${id}/letters/${LETTER_SLUGS.OpzioneCedolare}`, input, { responseType: 'blob' })).data,

  /** Marks a letter as sent on a day, by a means: an event in the history and nothing else. The answer is the operations as they are now. */
  markSent: async (id: string, kind: LeaseLetterKind, input: MarkLetterSentInput): Promise<LeaseOperations> =>
    expectOperations(
      await ApiClient.post<unknown>(`/leases/${id}/letters/${LETTER_SLUGS[kind]}/sent`, input),
      '/leases/:id/letters/:kind/sent',
    ),
};
