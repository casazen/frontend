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

/**
 * What a segment of the self-hosted verification lets the policy do (backend `IdentitySegmentModeCodes`): `observation` (the decision of the policy is recorded as the shadow decision and a person decides: the mode of
 * every segment until it is qualified), `automatic` (only a segment qualified for the policy and the weights in force) or `suspended` (taken back to a person by configuration, with a reason).
 */
export const IDENTITY_SEGMENT_MODES = ['observation', 'automatic', 'suspended'] as const;
export type IdentitySegmentMode = (typeof IDENTITY_SEGMENT_MODES)[number];

/** The longest reason of a suspension (backend `IdentitySegmentRules.SuspendedReasonMaxLength`); the server checks it again (422 `identity_segment_invalid`). */
export const IDENTITY_SEGMENT_REASON_MAX_LENGTH = 200;

/**
 * One segment (property × document format × browser, E70/F02/US01/T02, NF-194): `propertyId` is null for every property of the organization; `qualified` for the policy and the weights in force, or
 * `qualificationReason` says why not (`segment_not_qualified`, `qualification_mismatch`, `policy_unavailable`); `autoApprovalAllowed` and, when false, `autoApprovalReason` (the first condition that fails, a code of
 * `IdentitySegmentReasonCodes`). Ids, codes, versions and times only: nothing of a guest.
 */
export interface IdentitySegment {
  id: string;
  propertyId: string | null;
  propertyName: string | null;
  formatId: string;
  /** A code of the family of the browser (`web:ios-safari`, `web:android-chrome`, ...). */
  channel: string;
  mode: IdentitySegmentMode;
  qualified: boolean;
  qualificationReason: string | null;
  qualifiedPolicyVersion: string | null;
  qualifiedAt: string | null;
  autoApprovalAllowed: boolean;
  /** Add-only field: an API that does not send it leaves the reason out. */
  autoApprovalReason?: string | null;
  /** The level of document assurance the segment requires (`consistency` or `cryptographic`). */
  requiredAssurance: string;
  suspendedReason: string | null;
}

/** A format of the registry a segment can name: its id and its label for the staff. */
export interface IdentitySegmentFormat {
  id: string;
  label: string;
}

/** The decision policy in force: its version (null while none is usable) and whether it is provisional (nothing is approved automatically then). */
export interface IdentityActivePolicy {
  version: string | null;
  provisional: boolean;
}

/**
 * `GET api/settings/biometrics/segments` (404 while `checkInIdentitySelfHosted` is off, 403 for anyone but the org billing administrator): the segments with what each allows now, the formats and the channels a new
 * one can name, the policy in force and whether the platform permission of the automatic approval is on (`autoApprovalEnabled`).
 */
export interface IdentitySegments {
  segments: IdentitySegment[];
  formats: IdentitySegmentFormat[];
  channels: string[];
  activePolicy: IdentityActivePolicy;
  autoApprovalEnabled: boolean;
}

/** A new segment (`POST api/settings/biometrics/segments`): `propertyId` left out for every property of the organization; it starts in observation, and one that exists already is answered as it is. */
export interface CreateIdentitySegmentRequest {
  propertyId?: string;
  formatId: string;
  channel: string;
}

/**
 * The mode of a segment (`PUT api/settings/biometrics/segments/{id}`): `automatic` only for a qualified segment (422 `identity_segment_not_qualified` otherwise), `suspended` with a `reason` of 1 to 200 characters
 * (422 `identity_segment_invalid` otherwise), `observation` always. There is no qualification here: only platform administrators record one.
 */
export interface UpdateIdentitySegmentRequest {
  mode: IdentitySegmentMode;
  reason?: string;
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
