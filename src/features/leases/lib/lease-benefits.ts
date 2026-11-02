import type { LeaseDocument, LeaseDocumentKind } from '@/api/lease-documents.api';
import type { LeaseDetail } from '@/types';

/**
 * The benefits of a canone concordato (the IMU reduced by 25% and, where it is provided for, the cedolare secca at 10%) are claimed with
 * three documents, which the person takes to the accountant and to the comune once the contract is registered. They are the signed
 * contract, the attestation and the receipt of the registration, in the order the person meets them.
 */
export const BENEFIT_DOCUMENTS = ['contract', 'attestation', 'receipt'] as const;

/**
 * When the file that holds the contract holds its attestation too (CF-DOCS-REAL: the file the guided service delivers), the documents are two:
 * the contract with its attestation, which is one file, and the receipt of the registration.
 */
export const BENEFIT_DOCUMENTS_TOGETHER = ['contractWithAttestation', 'receipt'] as const;

export type BenefitDocument = (typeof BENEFIT_DOCUMENTS)[number] | (typeof BENEFIT_DOCUMENTS_TOGETHER)[number];

/** The kind a document is given when it is uploaded among the documents of the lease. */
export const BENEFIT_DOCUMENT_KIND: Readonly<Record<BenefitDocument, LeaseDocumentKind>> = {
  contract: 'Contract',
  contractWithAttestation: 'Contract',
  attestation: 'Attestation',
  receipt: 'Registration',
};

/** The words of each document: its name, and the label of the button that uploads it. The keys are written out so that the i18n test finds a missing one. */
export const BENEFIT_TEXT: Readonly<Record<BenefitDocument, { nameKey: string; uploadKey: string }>> = {
  contract: { nameKey: 'leaseRound.document.contract.name', uploadKey: 'leaseRound.document.contract.upload' },
  contractWithAttestation: { nameKey: 'leaseDocs.benefits.contractWithAttestation.name', uploadKey: 'leaseDocs.benefits.contractWithAttestation.upload' },
  attestation: { nameKey: 'leaseRound.document.attestation.name', uploadKey: 'leaseRound.document.attestation.upload' },
  receipt: { nameKey: 'leaseRound.document.receipt.name', uploadKey: 'leaseRound.document.receipt.upload' },
};

/** Where the file of a document is downloaded from: the signed copy or the receipt of the lease itself, or a document uploaded to it. */
export type BenefitSource = { from: 'signed' } | { from: 'receipt' } | { from: 'document'; document: LeaseDocument };

/** What a screen needs of a lease to tell which of the three documents it has (`isConcordatoFacileSource`: the lease of the guided service, CF-DONE). */
type BenefitLease = Pick<LeaseDetail, 'hasSignedPdf' | 'registration' | 'isConcordatoFacileSource'>;

/**
 * A contract of canone concordato, whoever made it: by type, and always the one the guided service prepared (it only prepares those).
 * Libero and transitorio contracts have no attestation and none of these benefits, so nothing about them is asked or told.
 */
export function isConcordatoLease(lease: Pick<LeaseDetail, 'contractType' | 'isConcordatoFacileSource'>): boolean {
  return lease.contractType === 'Concordato' || lease.isConcordatoFacileSource === true;
}

/** The follow-up of a registration is told once the contract is registered, and only for a canone concordato. */
export function showsBenefits(lease: Pick<LeaseDetail, 'status' | 'contractType' | 'isConcordatoFacileSource'>): boolean {
  return lease.status === 'Registered' && isConcordatoLease(lease);
}

/**
 * The last document of a kind uploaded to the lease (the one the person sent after the others, so the one they mean), if any. Of two sent
 * at the same moment it is the first in the list, which the server sends newest first.
 */
export function newestDocument(documents: readonly LeaseDocument[], kind: LeaseDocumentKind): LeaseDocument | undefined {
  let newest: LeaseDocument | undefined;
  for (const document of documents) {
    if (document.kind !== kind) continue;
    if (!newest || (Date.parse(document.uploadedAt) || 0) > (Date.parse(newest.uploadedAt) || 0)) newest = document;
  }
  return newest;
}

/**
 * The file of the lease that holds the contract AND its attestation (CF-DOCS-REAL), if there is one: the newest contract document the reading
 * recognized an attestation in. The person is not asked for the attestation again when it is there.
 *
 * `viaService` (CF-DONE): the lease is the one the guided service prepared, and the service delivers the signed contract and its attestation
 * in ONE file. Any contract file uploaded to such a lease is that file, whether or not the reading recognized the attestation inside it (a
 * scan can be hard to read): the attestation is taken from it and never asked for again.
 */
export function contractWithAttestation(documents: readonly LeaseDocument[], viaService = false): LeaseDocument | undefined {
  return newestDocument(
    documents.filter((document) => document.kind === 'Contract' && (viaService || document.containsAttestation === true)),
    'Contract',
  );
}

/** Whether the lease has its attestation: the document of that kind, or the contract file that holds it (`viaService`: see {@link contractWithAttestation}). */
export function hasAttestation(documents: readonly LeaseDocument[], viaService = false): boolean {
  return newestDocument(documents, 'Attestation') !== undefined || contractWithAttestation(documents, viaService) !== undefined;
}

/** The documents to bring after a registration: three, or two when the contract file holds the attestation (while the list is not known, three). */
export function benefitDocuments(documents: readonly LeaseDocument[] | undefined, viaService = false): readonly BenefitDocument[] {
  return documents && contractWithAttestation(documents, viaService) ? BENEFIT_DOCUMENTS_TOGETHER : BENEFIT_DOCUMENTS;
}

/**
 * Where the file of one of the documents is, `null` when the lease has none, `undefined` while that is not known (the documents of
 * the lease are not read yet, and the document is one that can be among them). The signed contract and the receipt of the registration
 * are the lease's own files when it has them; any other copy is a document uploaded to the lease. The contract with its attestation is
 * always the document that holds both: the signed copy of the lease may be another file.
 */
export function benefitSource(
  id: BenefitDocument,
  lease: BenefitLease,
  documents: readonly LeaseDocument[] | undefined,
): BenefitSource | null | undefined {
  if (id === 'contract' && lease.hasSignedPdf) return { from: 'signed' };
  if (id === 'receipt' && lease.registration?.hasReceipt) return { from: 'receipt' };
  if (!documents) return undefined;
  const document =
    id === 'contractWithAttestation' ? contractWithAttestation(documents, lease.isConcordatoFacileSource === true) : newestDocument(documents, BENEFIT_DOCUMENT_KIND[id]);
  return document ? { from: 'document', document } : null;
}
