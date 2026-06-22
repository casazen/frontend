export interface LegalDocumentMeta {
  version: string;
  effectiveAt: string;
  title: string;
  summary: string;
  documentUrl?: string | null;
}

export interface SubprocessorItem {
  name: string;
  purpose: string;
  region: string;
  website?: string | null;
}

export interface SubprocessorsDocument {
  version: string;
  effectiveAt: string;
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
