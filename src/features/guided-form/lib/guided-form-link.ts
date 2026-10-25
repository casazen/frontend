import type { CfPracticeStatus } from '@/types/concordatofacile.types';
import type { CfSimulatorLinkParams } from '@/types/cf-simulator.types';

/** The address of the simulated module (CF-SIM): the signed link of the contract leads here in the test environments. */
export const GUIDED_FORM_PATH = '/guided-form';

/** The parameters the signature covers or that identify the contract: the module takes them out of the address as soon as it has read them. */
const SIGNED_PARAMS = ['leaseId', 'expiresAt', 'signature'] as const;

const PARAMS = ['partner', 'leaseId', 'expiresAt', 'signature', 'comune', 'provincia'] as const;

/** The link as it arrived: the parameters that are there, and whether it still carries the signed ones (a new link, not a reload). */
export interface GuidedFormLink {
  params: CfSimulatorLinkParams;
  hasSignedParams: boolean;
}

/** Reads the six parameters of the signed link from the address. */
export function readGuidedFormLink(search: URLSearchParams): GuidedFormLink {
  const params: CfSimulatorLinkParams = {};
  for (const name of PARAMS) {
    const value = search.get(name);
    if (value) params[name] = value;
  }
  return { params, hasSignedParams: SIGNED_PARAMS.some((name) => name in params) };
}

/** True while the address still carries something the signature covers. */
export function hasSignedParams(search: URLSearchParams): boolean {
  return SIGNED_PARAMS.some((name) => search.has(name));
}

/** The address without the signed parameters (the municipality and the province stay: they are not secret). */
export function withoutSignedParams(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(search);
  for (const name of SIGNED_PARAMS) next.delete(name);
  return next;
}

/** The page of the contract the practice belongs to. */
export const guidedFormContractPath = (leaseId: string) => `/app/long-rent/leases/${encodeURIComponent(leaseId)}`;

/** The upload page of CasaZen opened with the number of the practice, like the button of the service that prepares the contract. */
export const guidedFormUploadPath = (practiceId: string) =>
  `/app/long-rent/documents/upload?practice=${encodeURIComponent(practiceId)}`;

/** A practice sent from this module, kept in the tab so that reloading the page does not lose its control token. */
export interface SubmittedPractice {
  practiceId: string;
  controlToken: string;
  status: CfPracticeStatus;
  /** False when the link was not good and the practice arrived without a reference to the contract. */
  linked: boolean;
  /** The contract the link named, when it was good: where "Torna al contratto" leads. */
  leaseId: string | null;
}

const STORAGE_KEY = 'cz-guided-form-practice';

/** The practice sent from this tab, if any. Storage that cannot be read (blocked, full) is the same as nothing. */
export function readSavedPractice(): SubmittedPractice | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SubmittedPractice>;
    if (typeof value.practiceId !== 'string' || typeof value.controlToken !== 'string' || typeof value.status !== 'string') return null;
    return {
      practiceId: value.practiceId,
      controlToken: value.controlToken,
      status: value.status,
      linked: value.linked === true,
      leaseId: typeof value.leaseId === 'string' ? value.leaseId : null,
    };
  } catch {
    return null;
  }
}

/** A new link starts a new round: what the tab remembered of the earlier one is forgotten. */
export function clearSavedPractice(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to forget if the storage cannot be reached.
  }
}

export function savePractice(practice: SubmittedPractice): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(practice));
  } catch {
    // Without storage the panel still works until the page is reloaded.
  }
}
