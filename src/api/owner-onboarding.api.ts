import { ApiClient } from './client';
import type {
  OwnerImportResult,
  OwnerInvitationAccepted,
  OwnerInvitationBatchResult,
  OwnerInvitationPreview,
  OwnerInvitationStatus,
  OwnerReadinessReport,
} from '@/types/owner-onboarding.types';

const INVITATIONS = '/onboarding/owners/invitations';
const invitationUrl = (invitationId: string) => `${INVITATIONS}/${encodeURIComponent(invitationId)}`;

/**
 * The owner portfolio of an agency in the onboarding and the acceptance of an invitation (E10/F02/US02, NF-109). The screens never call axios: they
 * compose the hooks of `src/queries/use-owner-onboarding.ts`, which call these methods.
 *
 * The owner import, the readiness and the batch of invitations answer 404 while the backend flag `Features:OctorateOnboarding` is off, and 403 to anyone
 * who is not on the agency plan with the agency permission (`agency.owner.view` for the readiness, `agency.owner.manage` for everything that writes): a screen
 * asks only when the person may. The acceptance of an invitation answers 404 while `Features:AgencyTier` is off. The server answers codes, ids and counts:
 * never a fiscal code, an IBAN, a link or a token of an invitation.
 */
export const ownerOnboardingApi = {
  getReadiness: (propertyId?: string) => ApiClient.get<OwnerReadinessReport>('/onboarding/owners/readiness', propertyId ? { propertyId } : undefined),

  importOwners: (file: File, dryRun: boolean) => {
    const body = new FormData();
    body.append('file', file);
    return ApiClient.post<OwnerImportResult>(`/onboarding/owners/import?dryRun=${dryRun ? 'true' : 'false'}`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  listInvitations: () => ApiClient.get<OwnerInvitationStatus[]>(INVITATIONS),

  previewInvitations: (ownerIds: readonly string[]) => ApiClient.post<OwnerInvitationPreview>(`${INVITATIONS}/preview`, { ownerIds }),

  /** Sends the batch of a preview: it carries the fingerprint of the preview (409 `owner_invitation_preview_stale` when the owners changed since). */
  confirmInvitations: (ownerIds: readonly string[], fingerprint: string) =>
    ApiClient.post<OwnerInvitationBatchResult>(`${INVITATIONS}/confirm`, { ownerIds, fingerprint }),

  resendInvitation: (invitationId: string) => ApiClient.post<OwnerInvitationStatus>(`${invitationUrl(invitationId)}/resend`),

  revokeInvitation: (invitationId: string) => ApiClient.post<OwnerInvitationStatus>(`${invitationUrl(invitationId)}/revoke`),

  /** The signed-in account accepts the invitation: the secret token goes in the body, never in a URL (URLs end up in logs and history). */
  acceptInvitation: (token: string) => ApiClient.post<OwnerInvitationAccepted>('/owner-invitations/accept', { token }),
};
