import type { LeaseStatus } from '@/types';

/**
 * Signature of a lease contract (LT-02, A7-02, D15). The default is the offline signature: the landlord downloads the
 * final contract, has it signed by every party on paper or with their own digital signature, then uploads the signed
 * PDF with the stipula date. An e-signature provider is used only when the API says it is available.
 */

/** Largest signed contract the API accepts (`LeaseSigningLimits.MaxSignedContractBytes`). */
export const LEASE_MAX_SIGNED_CONTRACT_BYTES = 20 * 1024 * 1024;

const BEFORE_FULL_SIGNATURE: LeaseStatus[] = ['Draft', 'AwaitingSignature', 'PartiallySigned'];

/** The contract is not signed by every party yet (the API's `RliRegistrationDeadline.IsBeforeFullSignature`). */
export function isBeforeFullSignature(status: LeaseStatus): boolean {
  return BEFORE_FULL_SIGNATURE.includes(status);
}

/** A non-empty PDF (by type or extension) within `maxBytes`; the API checks the content again. */
export function isPdfFile(file: File | null, maxBytes: number): file is File {
  if (!file || file.size === 0 || file.size > maxBytes) return false;
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
