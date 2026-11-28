import type { LeaseStatus } from '@/types';

export const LEASE_MAX_SIGNED_CONTRACT_BYTES = 20 * 1024 * 1024;

const BEFORE_FULL_SIGNATURE: LeaseStatus[] = ['Draft', 'AwaitingSignature', 'PartiallySigned'];

export function isBeforeFullSignature(status: LeaseStatus): boolean {
  return BEFORE_FULL_SIGNATURE.includes(status);
}

export function isPdfFile(file: File | null, maxBytes: number): file is File {
  if (!file || file.size === 0 || file.size > maxBytes) return false;
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
