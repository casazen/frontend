import type { CfPracticeStatus } from '@/types/concordatofacile.types';
import type { CfSimulatorLinkParams } from '@/types/cf-simulator.types';

export const GUIDED_FORM_PATH = '/guided-form';

const SIGNED_PARAMS = ['leaseId', 'expiresAt', 'signature'] as const;

const PARAMS = ['partner', 'leaseId', 'expiresAt', 'signature', 'comune', 'provincia'] as const;

export interface GuidedFormLink {
  params: CfSimulatorLinkParams;
  hasSignedParams: boolean;
}

export function readGuidedFormLink(search: URLSearchParams): GuidedFormLink {
  const params: CfSimulatorLinkParams = {};
  for (const name of PARAMS) {
    const value = search.get(name);
    if (value) params[name] = value;
  }
  return { params, hasSignedParams: SIGNED_PARAMS.some((name) => name in params) };
}

export function hasSignedParams(search: URLSearchParams): boolean {
  return SIGNED_PARAMS.some((name) => search.has(name));
}

export function withoutSignedParams(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(search);
  for (const name of SIGNED_PARAMS) next.delete(name);
  return next;
}

export const guidedFormContractPath = (leaseId: string) => `/app/long-rent/leases/${encodeURIComponent(leaseId)}`;

export const guidedFormUploadPath = (practiceId: string) =>
  `/app/long-rent/documents/upload?practice=${encodeURIComponent(practiceId)}`;

/** A practice sent from this module, kept in the tab so that reloading the page does not lose its control token. */
export interface SubmittedPractice {
  practiceId: string;
  controlToken: string;
  status: CfPracticeStatus;
  linked: boolean;
  leaseId: string | null;
}

const STORAGE_KEY = 'cz-guided-form-practice';

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
