import { describe, expect, it } from 'vitest';
import type { LeaseDocument, LeaseDocumentKind } from '@/api/lease-documents.api';
import { BENEFIT_DOCUMENTS, BENEFIT_DOCUMENTS_TOGETHER, benefitDocuments, benefitSource, contractWithAttestation, hasAttestation } from '../lease-benefits';

function document(kind: LeaseDocumentKind, overrides: Partial<LeaseDocument> = {}): LeaseDocument {
  return { id: `${kind}-1`, leaseId: 'lease-1', kind, fileName: `${kind}.pdf`, sizeBytes: 10, uploadedAt: '2026-10-25T10:00:00Z', ...overrides };
}

// CF-DONE: the guided service delivers the signed contract and its attestation in ONE file. For the lease it prepared, any contract file
// uploaded to it is that file, whether or not the reading recognized the attestation inside it; for any other lease only a file whose
// reading recognized it counts, as before.
describe('the attestation inside the contract file', () => {
  const unrecognized = document('Contract', { containsAttestation: false });
  const recognized = document('Contract', { id: 'Contract-2', containsAttestation: true });
  const older = document('Contract', { id: 'Contract-3' });

  it('contractWithAttestation_NotViaService_OnlyAFileWhoseReadingRecognizedItCounts', () => {
    expect(contractWithAttestation([unrecognized, older])).toBeUndefined();
    expect(contractWithAttestation([unrecognized, recognized, older])).toBe(recognized);
  });

  it.each([
    ['a file whose reading did not recognize the attestation', [unrecognized]],
    ['a file of an older reading that says nothing about it', [older]],
  ])('contractWithAttestation_ViaService_%s_StillHoldsIt', (_label, documents) => {
    expect(contractWithAttestation(documents, true)).toBe(documents[0]);
  });

  it('contractWithAttestation_ViaService_TheNewestContractFileIsTheOne_AndNoOtherKindIs', () => {
    const newer = document('Contract', { id: 'Contract-4', uploadedAt: '2026-10-26T10:00:00Z' });
    expect(contractWithAttestation([unrecognized, newer], true)).toBe(newer);
    expect(contractWithAttestation([document('Registration'), document('Other'), document('Attestation')], true)).toBeUndefined();
  });

  it.each([
    ['no document at all', [], false, false],
    ['a contract file not recognized as holding it, a lease that is not the service’s', [unrecognized], false, false],
    ['a contract file not recognized as holding it, the service’s lease', [unrecognized], true, true],
    ['a contract file recognized as holding it', [recognized], false, true],
    ['an attestation uploaded on its own', [document('Attestation')], false, true],
    ['the receipt only, the service’s lease: no contract file, so nothing holds it', [document('Registration')], true, false],
  ] as const)('hasAttestation_%s', (_label, documents, viaService, expected) => {
    expect(hasAttestation(documents, viaService)).toBe(expected);
  });

  it('hasAttestation_NoSecondArgument_IsTheAnswerForALeaseThatIsNotTheServices', () => {
    expect(hasAttestation([unrecognized])).toBe(false);
    expect(hasAttestation([recognized])).toBe(true);
  });

  it('benefitDocuments_TwoWhenTheContractFileHoldsTheAttestation_AlsoForTheServicesLeaseWhateverTheReadingFound', () => {
    expect(benefitDocuments(undefined, true)).toBe(BENEFIT_DOCUMENTS);
    expect(benefitDocuments([unrecognized])).toBe(BENEFIT_DOCUMENTS);
    expect(benefitDocuments([unrecognized], true)).toBe(BENEFIT_DOCUMENTS_TOGETHER);
    expect(benefitDocuments([recognized])).toBe(BENEFIT_DOCUMENTS_TOGETHER);
  });

  it('benefitSource_ContractWithAttestation_IsTheContractFileOfTheServicesLease', () => {
    const lease = { hasSignedPdf: false, registration: null };

    expect(benefitSource('contractWithAttestation', { ...lease, isConcordatoFacileSource: true }, [unrecognized])).toEqual({ from: 'document', document: unrecognized });
    expect(benefitSource('contractWithAttestation', lease, [unrecognized])).toBeNull();
    expect(benefitSource('contractWithAttestation', lease, undefined)).toBeUndefined();
  });
});
