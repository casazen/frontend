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
  get: () => ApiClient.get<BiometricSettings>('/settings/biometrics', undefined, { localAuthRecovery: true }),

  update: (request: UpdateBiometricSettingsRequest) => ApiClient.put<BiometricSettings>('/settings/biometrics', request),

  /** Per model: name, state and why it cannot be used. Platform administrators only (403 otherwise). */
  getModelsStatus: () => ApiClient.get<BiometricsStatus>('/admin/biometrics/status', undefined, { localAuthRecovery: true }),

  getSegments: () => ApiClient.get<IdentitySegments>('/settings/biometrics/segments', undefined, { localAuthRecovery: true }),

  createSegment: (request: CreateIdentitySegmentRequest) => ApiClient.post<IdentitySegment>('/settings/biometrics/segments', request),

  updateSegment: (id: string, request: UpdateIdentitySegmentRequest) =>
    ApiClient.put<IdentitySegment>(`/settings/biometrics/segments/${encodeURIComponent(id)}`, request),
};
