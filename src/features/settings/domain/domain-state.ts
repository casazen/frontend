import type { DomainIssueCode, DomainSurfaces, DomainVerificationStatus } from '@/types/domain.types';

type TranslateFn = (key: string) => string;

/**
 * What the host sees of a custom domain (BK-17, A3-25). Never "verified" without the real checks: the status comes from
 * the server, which verifies the TXT ownership record, the DNS towards the service and the domain on the service itself.
 *
 * - `waitingDns`: the host has to create (or wait for) DNS records;
 * - `activating`: the records are not the problem: the platform cannot activate the domain yet (setting missing, provider
 *   not answering) and retries by itself;
 * - `verified` and `failed`.
 */
export type DomainState = 'verified' | 'waitingDns' | 'activating' | 'failed';

const PLATFORM_CODES: ReadonlySet<string> = new Set<DomainIssueCode>([
  'vercel_not_configured',
  'vercel_unauthorized',
  'vercel_unavailable',
]);

const KNOWN_CODES: ReadonlySet<string> = new Set<DomainIssueCode>([
  'ownership_txt_missing',
  'dns_not_pointing',
  'vercel_verification_pending',
  'vercel_not_configured',
  'vercel_unauthorized',
  'vercel_unavailable',
  'domain_taken',
  'vercel_domain_in_use',
  'vercel_rejected',
]);

export function getDomainState(status: DomainVerificationStatus, detail?: string | null): DomainState {
  if (status === 'Verified') return 'verified';
  if (status === 'Failed') return 'failed';
  return detail && PLATFORM_CODES.has(detail) ? 'activating' : 'waitingDns';
}

export type OwnerLoginLine = 'failed' | 'notRequested' | 'pendingAutomatic' | 'pendingManual' | 'ready';

export function ownerLoginState(surfaces: Pick<DomainSurfaces, 'ownerLoginHostState' | 'ownerLoginAutomatic'>): OwnerLoginLine {
  switch (surfaces.ownerLoginHostState) {
    case 'Pending':
      return surfaces.ownerLoginAutomatic ? 'pendingAutomatic' : 'pendingManual';
    case 'Ready':
      return 'ready';
    case 'Failed':
      return 'failed';
    default:
      return 'notRequested';
  }
}

export function describeDomainIssue(
  detail: string | null | undefined,
  serverMessage: string | null | undefined,
  t: TranslateFn,
): string | undefined {
  if (detail && KNOWN_CODES.has(detail)) return t(`domain.issues.${detail}`);
  return serverMessage?.trim() || undefined;
}
