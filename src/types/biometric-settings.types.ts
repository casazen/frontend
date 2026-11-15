/**
 * The identity verification of the organization, as the host sees it (E22/F02/US01/T02). Mirrors backend DTOs of `Casazen.Web/DTOs/CheckIn/BiometricSettingsDtos.cs` and
 * `Casazen.Web/DTOs/Admin/BiometricsStatusDtos.cs`.
 */

/** The bounds the API holds the settings to (backend `BiometricSettingsService`); the server checks them again and answers 422 with the code of the one that failed. */
export const BIOMETRIC_ESCALATE_MIN = 0.5;
export const BIOMETRIC_ACCEPT_MAX = 0.95;
export const BIOMETRIC_ATTEMPTS_MIN = 1;
export const BIOMETRIC_ATTEMPTS_MAX = 5;

/** `GET/PUT api/settings/biometrics`: whether the face check is on, the two thresholds of the similarity, the attempts, and whether the thresholds are still provisional. */
export interface BiometricSettings {
  /** The face check is on for the organization (a person verifies otherwise). */
  enabled: boolean;
  /** From this similarity the face is accepted without a person. */
  acceptThreshold: number;
  /** Between this and the accept threshold a person decides; at or under it the attempt does not pass. */
  escalateThreshold: number;
  /** The attempts of a guest before a person takes over (1 to 5). */
  maxAttempts: number;
  /** The thresholds were never calibrated on real data (or were changed since): the outcomes are provisional. */
  provisional: boolean;
  /** When a platform administrator marked the calibration; `null` while provisional. */
  calibratedAt: string | null;
  /** The organization has no row of its own yet: these are the defaults. */
  isDefault: boolean;
}

/** What an organization administrator sends: a member left out keeps its value. There is no calibration here: only platform staff marks one. */
export interface UpdateBiometricSettingsRequest {
  enabled?: boolean;
  acceptThreshold?: number;
  escalateThreshold?: number;
  maxAttempts?: number;
}

/** One model of the set (`GET api/admin/biometrics/status`): no path, no hash and no address, so a status can be pasted into a ticket. */
export interface BiometricModelStatus {
  /** `face_detector`, `anti_spoofing`, `face_recognition` or `mrz_ocr`. */
  role: string;
  name: string;
  version: string;
  license: string;
  /** `disabled`, `loading`, `ready`, `present` or `failed`. */
  state: string;
  /** Why the model cannot be used (`hash_not_configured`, `file_missing`, `hash_mismatch`, ...), when it failed. */
  code?: string | null;
  /** The SHA-256 of the file is pinned in the configuration: without it the file is never used. */
  pinned: boolean;
}

/** The models of the identity verification as platform administrators see them. */
export interface BiometricsStatus {
  /** The feature flag is on. */
  enabled: boolean;
  /** `disabled`, `loading`, `ready` or `unavailable` (every verification then goes to a person). */
  state: string;
  reasonCode?: string | null;
  models: BiometricModelStatus[];
}
