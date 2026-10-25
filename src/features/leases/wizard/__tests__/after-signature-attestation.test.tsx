import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { buildDetail, httpError, renderAt } from '../../__tests__/lease-test-utils';
import { AfterSignatureStep } from '../after-signature-step';
import type { LeaseDetail } from '@/types';

// CF-END: the last step of «Crea contratto» asks for the attestation of a canone concordato and never of another contract. The checklist,
// the tax advice and the rents of the step answer 404 here: the step does not depend on them.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

/** A document of the lease as the API lists it (`GET /leases/:id/documents`). */
function attestationDocument(fileName: string) {
  return { id: 'doc-attestation', leaseId: 'lease-1', kind: 'Attestation', fileName, sizeBytes: 2048, uploadedAt: '2026-10-24T10:00:00Z' };
}

function signed(overrides: Partial<LeaseDetail> = {}): LeaseDetail {
  return buildDetail({ status: 'Signed', hasSignedPdf: true, registration: null, ...overrides });
}

function mockDocuments(read: () => unknown[]) {
  get.mockImplementation((url: string) =>
    url === '/leases/lease-1/documents' ? Promise.resolve({ data: read() }) : Promise.reject(httpError(404)),
  );
}

function renderStep(lease: LeaseDetail) {
  return renderAt('/step', '/step', <AfterSignatureStep lease={lease} declareFirst={false} />);
}

describe('AfterSignatureStep — the attestation of a canone concordato (CF-END)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('render_ConcordatoWithoutAttestation_AsksForItWithTheReasonAndTheButton_AndStopsNothing', async () => {
    mockDocuments(() => []);

    renderStep(signed({ contractType: 'Concordato' }));

    const section = await screen.findByTestId('lease-after-attestation');
    await waitFor(() => expect(within(section).getByTestId('lease-after-attestation-status')).toHaveTextContent('Attestazione: ancora da caricare'));
    expect(section).toHaveTextContent("L'attestazione dimostra che il canone rispetta l'accordo territoriale: serve per le agevolazioni.");
    // The declaration of the registration is not held back by it.
    expect(screen.getByTestId('lease-after-mark-registered')).toBeEnabled();
    fireEvent.click(within(section).getByRole('button', { name: "Carica l'attestazione" }));
    expect(await screen.findByTestId('lease-document-upload-dialog')).toHaveTextContent("Carica l'attestazione");
  });

  it('upload_AttestationFromTheStep_IsSentAsAnAttestationAndTheStepShowsItUploaded', async () => {
    let documents: unknown[] = [];
    mockDocuments(() => documents);
    post.mockImplementation((_url, body) => {
      const file = (body as FormData).get('file') as File;
      documents = [attestationDocument(file.name)];
      return Promise.resolve({ data: documents[0] });
    });

    renderStep(signed({ contractType: 'Concordato' }));

    fireEvent.click(await screen.findByTestId('lease-after-attestation-upload'));
    const dialog = await screen.findByTestId('lease-document-upload-dialog');
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['%PDF-1.4 attestazione'], 'attestazione.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(within(dialog).getByTestId('lease-document-upload-submit'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const body = post.mock.calls[0][1] as FormData;
    expect(post.mock.calls[0][0]).toBe('/leases/lease-1/documents');
    expect(body.get('kind')).toBe('Attestation');
    expect((body.get('file') as File).name).toBe('attestazione.pdf');
    const status = within(screen.getByTestId('lease-after-attestation')).getByTestId('lease-after-attestation-status');
    await waitFor(() => expect(status).toHaveTextContent('Attestazione: caricata'));
    expect(status).toHaveTextContent('attestazione.pdf');
    expect(screen.getByTestId('lease-after-attestation-upload')).toHaveTextContent('Carica un nuovo file');
  });

  // CF-DOCS-REAL: the contract file that was uploaded holds the attestation too (the reading recognized its pages): it is not asked twice.
  it('render_ContractFileThatHoldsTheAttestation_SaysItIsIncluded_AndAsksForNothingMore', async () => {
    mockDocuments(() => [
      {
        id: 'doc-contract',
        leaseId: 'lease-1',
        kind: 'Contract',
        fileName: 'contratto-e-attestazione.pdf',
        sizeBytes: 4096,
        uploadedAt: '2026-10-24T10:00:00Z',
        sections: [
          { kind: 'contract', firstPage: 1, lastPage: 6 },
          { kind: 'attestation', firstPage: 7, lastPage: 10 },
          { kind: 'calculationSheet', firstPage: 11, lastPage: 14 },
        ],
        containsAttestation: true,
        containsCalculationSheet: true,
      },
    ]);

    renderStep(signed({ contractType: 'Concordato' }));

    const status = await screen.findByTestId('lease-after-attestation-included');
    expect(status).toHaveTextContent('Attestazione: inclusa nel contratto caricato');
    expect(within(screen.getByTestId('lease-after-attestation')).getByTestId('lease-after-attestation-status')).toHaveTextContent('contratto-e-attestazione.pdf');
    // No second request: nothing to upload and nothing says «ancora da caricare».
    expect(screen.queryByTestId('lease-after-attestation-upload')).not.toBeInTheDocument();
    expect(screen.getByTestId('lease-after-attestation')).not.toHaveTextContent('ancora da caricare');
  });

  it('render_ContractMadeWithTheService_AsksForItWhateverItsType', async () => {
    mockDocuments(() => []);

    renderStep(signed({ contractType: 'Libero', isConcordatoFacileSource: true }));

    expect(await screen.findByTestId('lease-after-attestation')).toBeInTheDocument();
  });

  it.each(['Libero', 'Transitorio'] as const)('render_%sContract_AsksForNoAttestationAndReadsNoDocuments', async (contractType) => {
    mockDocuments(() => []);

    renderStep(signed({ contractType }));

    expect(await screen.findByTestId('lease-after-step')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-after-attestation')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).endsWith('/documents'))).toBe(false);
  });
});
