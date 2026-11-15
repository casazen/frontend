import { ApiClient } from './client';
import type { BiometricSettings, BiometricsStatus, UpdateBiometricSettingsRequest } from '@/types/biometric-settings.types';

/**
 * The identity verification of the organization (E22/F02/US01/T02, ADR-013-R13). The settings are the organization's own (`OrgBillingAdmin`, no organization in the route) and sit behind the
 * flag `checkInIdentityVerification` (404 while it is off); the status of the models is for platform administrators (`AdminOnly`) and is not behind the flag.
 */
export const biometricSettingsApi = {
  /** The settings in force: the row of the organization, or the defaults (`isDefault`) while it has none. */
  get: () => ApiClient.get<BiometricSettings>('/settings/biometrics'),

  /**
   * Saves the settings: 0.50 <= escalate < accept <= 0.95 and attempts 1 to 5, or 422 `biometric_thresholds_out_of_range`, `biometric_thresholds_order_invalid` or
   * `biometric_attempts_out_of_range` and nothing is saved. A change leaves the thresholds provisional.
   */
  update: (request: UpdateBiometricSettingsRequest) => ApiClient.put<BiometricSettings>('/settings/biometrics', request),

  /** Per model: name, state and why it cannot be used. Platform administrators only (403 otherwise). */
  getModelsStatus: () => ApiClient.get<BiometricsStatus>('/admin/biometrics/status'),
};
