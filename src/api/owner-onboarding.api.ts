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
  /** What is missing for the owner accounting and for the portal, on every owner and property the caller reaches. Read only. */
  getReadiness: () => ApiClient.get<OwnerReadinessReport>('/onboarding/owners/readiness'),

  /**
   * Checks the file (`dryRun`, nothing is written) or imports it (only the valid rows). The file is read by the server only: the app never parses it and
   * never keeps its content. The import never sends an invitation.
   */
  importOwners: (file: File, dryRun: boolean) => {
    const body = new FormData();
    body.append('file', file);
    // Explicit multipart: the client's default JSON content type would serialize the form data as JSON.
    return ApiClient.post<OwnerImportResult>(`/onboarding/owners/import?dryRun=${dryRun ? 'true' : 'false'}`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Every owner inside the reach with the state of its invitation: no address, no link. */
  listInvitations: () => ApiClient.get<OwnerInvitationStatus[]>(INVITATIONS),

  /** The batch that confirming would send. Nothing is sent. 422 `owner_invitation_selection_empty` for an empty list of owners: it never means «all». */
  previewInvitations: (ownerIds: readonly string[]) => ApiClient.post<OwnerInvitationPreview>(`${INVITATIONS}/preview`, { ownerIds }),

  /** Sends the batch of a preview: it carries the fingerprint of the preview (409 `owner_invitation_preview_stale` when the owners changed since). */
  confirmInvitations: (ownerIds: readonly string[], fingerprint: string) =>
    ApiClient.post<OwnerInvitationBatchResult>(`${INVITATIONS}/confirm`, { ownerIds, fingerprint }),

  /** A new link to the owner of the invitation: the one in force stops working. 409 `owner_invitation_used` when the owner has accepted. */
  resendInvitation: (invitationId: string) => ApiClient.post<OwnerInvitationStatus>(`${invitationUrl(invitationId)}/resend`),

  /** Withdraws an invitation in force: its link stops working. */
  revokeInvitation: (invitationId: string) => ApiClient.post<OwnerInvitationStatus>(`${invitationUrl(invitationId)}/revoke`),

  /** The signed-in account accepts the invitation: the secret token goes in the body, never in a URL (URLs end up in logs and history). */
  acceptInvitation: (token: string) => ApiClient.post<OwnerInvitationAccepted>('/owner-invitations/accept', { token }),
};
