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
