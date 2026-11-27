import { ApiClient } from './client';
import type {
  BiometricSettings,
  BiometricsStatus,
  CreateIdentitySegmentRequest,
  IdentitySegment,
  IdentitySegments,
  UpdateBiometricSettingsRequest,
  UpdateIdentitySegmentRequest,
} from '@/types/biometric-settings.types';

/**
 * The identity verification of the organization (E22/F02/US01/T02, ADR-013-R13). The settings are the organization's own (`OrgBillingAdmin`, no organization in the route) and sit behind the
 * flag `checkInIdentityVerification` (404 while it is off); the status of the models is for platform administrators (`AdminOnly`) and is not behind the flag.
 *
 * Both reads sit in a card of a page that has other things on it, and keep a 403 on that card (`localAuthRecovery`): the card says it cannot be read, instead of the app opening «no access» and
 * taking the whole page away (the screen guesses who may read them from the contexts of the user, the server decides, and the two can differ: a role that is not in the token yet).
 */
export const biometricSettingsApi = {
  /** The settings in force: the row of the organization, or the defaults (`isDefault`) while it has none. */
  get: () => ApiClient.get<BiometricSettings>('/settings/biometrics', undefined, { localAuthRecovery: true }),

  /**
   * Saves the settings: 0.50 <= escalate < accept <= 0.95 and attempts 1 to 5, or 422 `biometric_thresholds_out_of_range`, `biometric_thresholds_order_invalid` or
   * `biometric_attempts_out_of_range` and nothing is saved. A change leaves the thresholds provisional.
   */
  update: (request: UpdateBiometricSettingsRequest) => ApiClient.put<BiometricSettings>('/settings/biometrics', request),

  /** Per model: name, state and why it cannot be used. Platform administrators only (403 otherwise). */
  getModelsStatus: () => ApiClient.get<BiometricsStatus>('/admin/biometrics/status', undefined, { localAuthRecovery: true }),

  /**
   * The segments of the self-hosted verification of the organization (E70/F02/US01/T02, NF-194): what each lets the policy do now, the formats and channels a new one can name, the policy in force and whether the
   * platform permission of the automatic approval is on. Also behind the flag `checkInIdentitySelfHosted` (404 while it is off). Kept on the card on a 403, like the settings.
   */
  getSegments: () => ApiClient.get<IdentitySegments>('/settings/biometrics/segments', undefined, { localAuthRecovery: true }),

  /** A new segment, in observation; one that exists already is answered as it is. 422 `identity_segment_invalid` for a format, a channel or a property that is not one of the organization's. */
  createSegment: (request: CreateIdentitySegmentRequest) => ApiClient.post<IdentitySegment>('/settings/biometrics/segments', request),

  /**
   * The mode of a segment: `automatic` only when it is qualified (422 `identity_segment_not_qualified`), `suspended` with a reason of 1 to 200 characters (422 `identity_segment_invalid`), `observation` always.
   * 404 for a segment that is not the organization's. Qualification is done by platform administrators through the admin API: it is never sent from here.
   */
  updateSegment: (id: string, request: UpdateIdentitySegmentRequest) =>
    ApiClient.put<IdentitySegment>(`/settings/biometrics/segments/${encodeURIComponent(id)}`, request),
};
