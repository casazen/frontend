/** Legal documents a host accepts (PL-14): `GET /api/legal/{key}`. */
export type LegalDocumentKey = 'tos' | 'privacy' | 'dpa';

export interface LegalDocumentMeta {
  key?: LegalDocumentKey;
  version: string;
  /** Date the version is in force; null while not configured on the backend. */
  effectiveAt: string | null;
  title: string;
  summary: string;
  /** Optional external copy of the official text (https). */
  documentUrl?: string | null;
  /** False while the product owner has not provided the text (D14): the page says "in preparation". */
  available?: boolean;
  /** Sanitized HTML of the text, provided by the product owner. Sanitize again before rendering. */
  contentHtml?: string | null;
  /** Language of `contentHtml`: the requested one, or `it` when no translation exists. */
  contentLanguage?: string | null;
}

export interface SubprocessorItem {
  /** Stable identifier of the provider (e.g. `auth0`). */
  key?: string | null;
  name: string;
  purpose: string;
  /** Localized purpose key (`legal.subprocessors.purposes.*`); null when the purpose is configured text. */
  purposeKey?: string | null;
  region: string;
  website?: string | null;
  /** Legal entity and registered office, as configured by the product owner. */
  entity?: string | null;
  /** Legal basis of a transfer outside the EEA, when there is one. */
  transferMechanism?: string | null;
  /** Legal entity, location or transfer basis still to be completed (never invented). */
  detailsPending?: boolean;
}

export interface SubprocessorsDocument {
  version: string;
  effectiveAt: string | null;
  items: SubprocessorItem[];
}

export interface OnboardingConsentsPayload {
  tosAccepted: boolean;
  tosVersion: string;
  privacyAccepted: boolean;
  privacyVersion: string;
  dpaAccepted: boolean;
  dpaVersion: string;
  subprocessorsAcknowledged: boolean;
  subprocessorsVersion: string;
  marketingOptIn?: boolean;
}

/** Steps of the activation checklist (PL-15): stable keys of `GET /api/onboarding/status`. */
export type ActivationStepKey =
  | 'account'
  | 'organization'
  | 'property'
  | 'cin'
  | 'payments'
  | 'sitePublished'
  | 'firstBooking';

/**
 * `done`: the stored state proves it. `todo`: not started. `inProgress`: started, something is still missing.
 * `blocked`: another step comes first.
 */
export type ActivationStepState = 'done' | 'todo' | 'inProgress' | 'blocked';

/** Why a step is not done: stable codes of the backend (`ActivationStepReasons`), translated by the client. */
export const ACTIVATION_STEP_REASONS = [
  'onboarding_incomplete',
  'org_profile_incomplete',
  'no_property',
  'cin_missing_or_invalid',
  'connect_not_started',
  'connect_requirements_due',
  'connect_pending_verification',
  'org_inactive',
  'properties_paused',
  'compliance_pending',
  'properties_inactive',
  'payments_not_ready',
  'site_not_published',
  'awaiting_first_booking',
] as const;

export type ActivationStepReason = (typeof ACTIVATION_STEP_REASONS)[number];

export interface ActivationStep {
  key: ActivationStepKey;
  state: ActivationStepState;
  /** Null when the step is done. */
  reason?: ActivationStepReason | null;
  /** Properties that satisfy the step (valid CIN, published), for the steps that count them. */
  done?: number | null;
  /** Properties of the org, for the steps that count them. */
  total?: number | null;
}

/** `GET /api/onboarding/status`: the activation of the caller's org, derived from stored state (PL-15). */
export interface OnboardingStatus {
  roleChosen: boolean;
  orgProvisioned: boolean;
  consentsAccepted: boolean;
  propertyCreated: boolean;
  /** True only when a published property can really be booked and paid (Stripe charges enabled). */
  sitePublished: boolean;
  firstBookingTaken: boolean;
  activated: boolean;
  /** Link to share; null until the site is really published or when the public domain is not configured (D3). */
  publicBookingUrl?: string | null;
  steps: ActivationStep[];
}
