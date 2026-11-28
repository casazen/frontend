export const BIOMETRIC_ESCALATE_MIN = 0.5;
export const BIOMETRIC_ACCEPT_MAX = 0.95;
export const BIOMETRIC_ATTEMPTS_MIN = 1;
export const BIOMETRIC_ATTEMPTS_MAX = 5;

export interface BiometricSettings {
  /** The face check is on for the organization (a person verifies otherwise). */
  enabled: boolean;
  acceptThreshold: number;
  escalateThreshold: number;
  maxAttempts: number;
  /** The thresholds were never calibrated on real data (or were changed since): the outcomes are provisional. */
  provisional: boolean;
  calibratedAt: string | null;
  isDefault: boolean;
}

export interface UpdateBiometricSettingsRequest {
  enabled?: boolean;
  acceptThreshold?: number;
  escalateThreshold?: number;
  maxAttempts?: number;
}

export const IDENTITY_SEGMENT_MODES = ['observation', 'automatic', 'suspended'] as const;
export type IdentitySegmentMode = (typeof IDENTITY_SEGMENT_MODES)[number];

export const IDENTITY_SEGMENT_REASON_MAX_LENGTH = 200;

export interface IdentitySegment {
  id: string;
  propertyId: string | null;
  propertyName: string | null;
  formatId: string;
  channel: string;
  mode: IdentitySegmentMode;
  qualified: boolean;
  qualificationReason: string | null;
  qualifiedPolicyVersion: string | null;
  qualifiedAt: string | null;
  autoApprovalAllowed: boolean;
  autoApprovalReason?: string | null;
  requiredAssurance: string;
  suspendedReason: string | null;
}

export interface IdentitySegmentFormat {
  id: string;
  label: string;
}

export interface IdentityActivePolicy {
  version: string | null;
  provisional: boolean;
}

export interface IdentitySegments {
  segments: IdentitySegment[];
  formats: IdentitySegmentFormat[];
  channels: string[];
  activePolicy: IdentityActivePolicy;
  autoApprovalEnabled: boolean;
}

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

export interface BiometricModelStatus {
  role: string;
  name: string;
  version: string;
  license: string;
  state: string;
  code?: string | null;
  pinned: boolean;
}

export interface BiometricsStatus {
  enabled: boolean;
  state: string;
  reasonCode?: string | null;
  models: BiometricModelStatus[];
}
