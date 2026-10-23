import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as propertyQueries from '@/queries/use-properties';
import type { PropertyDocumentDto } from '@/types';
import { PropertyDocumentsSection } from '../property-documents-section';

vi.mock('@/queries/use-properties');

const PROPERTY_ID = 'prop-1';
const documents: PropertyDocumentDto[] = [
  {
    id: 'doc-1',
    fileName: 'Certificato CIN.pdf',
    fileType: 'pdf',
    documentType: 'CinCertificate',
    uploadedAt: '2026-09-01T10:00:00Z',
    downloadUrl: `/api/properties/${PROPERTY_ID}/documents/doc-1/download`,
  },
  {
    id: 'doc-2',
    fileName: 'Planimetria.png',
    fileType: 'png',
    documentType: 'FloorPlan',
    uploadedAt: '2026-09-02T10:00:00Z',
    downloadUrl: `/api/properties/${PROPERTY_ID}/documents/doc-2/download`,
  },
];

/** An APE uploaded before its code and class were read automatically. */
const APE_TO_IDENTIFY: PropertyDocumentDto = {
  id: 'doc-ape',
  fileName: 'ape.pdf',
  fileType: 'pdf',
  documentType: 'Ape',
  uploadedAt: '2026-09-03T10:00:00Z',
  downloadUrl: `/api/properties/${PROPERTY_ID}/documents/doc-ape/download`,
  apeCode: null,
  apeEnergyClass: null,
};

function mockRead(state: { isPending?: boolean; isSuccess?: boolean } = {}) {
  const mutate = vi.fn();
  vi.mocked(propertyQueries.useReadApeIdentification).mockReturnValue({
    mutate,
    isPending: false,
    isSuccess: false,
    ...state,
  } as unknown as ReturnType<typeof propertyQueries.useReadApeIdentification>);
  return mutate;
}

function mockAutoRead(state: { isFetching?: boolean; isSuccess?: boolean } = {}) {
  vi.mocked(propertyQueries.useApeAutoRead).mockReturnValue({
    isFetching: false,
    isSuccess: false,
    ...state,
  } as unknown as ReturnType<typeof propertyQueries.useApeAutoRead>);
}

function mockDownload(overrides: Partial<ReturnType<typeof propertyQueries.useDownloadPropertyDocument>> = {}) {
  const mutate = vi.fn();
  vi.mocked(propertyQueries.useDownloadPropertyDocument).mockReturnValue({
    mutate,
    isPending: false,
    variables: undefined,
    ...overrides,
  } as unknown as ReturnType<typeof propertyQueries.useDownloadPropertyDocument>);
  return mutate;
}

describe('PropertyDocumentsSection (FD-07, A2-03/A2-31)', () => {
  beforeEach(() => {
    vi.mocked(propertyQueries.useUploadPropertyDocument).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof propertyQueries.useUploadPropertyDocument>);
    mockRead();
    mockAutoRead();
    localStorage.clear();
    vi.mocked(propertyQueries.useDeletePropertyDocument).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof propertyQueries.useDeletePropertyDocument>);
  });

  it('download_click_usesAuthenticatedApiInsteadOfALink', () => {
    const mutate = mockDownload();
    render(<PropertyDocumentsSection propertyId={PROPERTY_ID} documents={documents} />);

    // No anchor to the file: on Vercel a relative href is rewritten to index.html and the
    // document is private anyway.
    expect(screen.queryAllByRole('link')).toHaveLength(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Scarica' })[0]);

    expect(mutate).toHaveBeenCalledWith({
      propertyId: PROPERTY_ID,
      docId: 'doc-1',
      fileName: 'Certificato CIN.pdf',
    });
  });

  it('download_pending_disablesOnlyThatDocumentButton', () => {
    mockDownload({
      isPending: true,
      variables: { propertyId: PROPERTY_ID, docId: 'doc-2', fileName: 'Planimetria.png' },
    });
    render(<PropertyDocumentsSection propertyId={PROPERTY_ID} documents={documents} />);

    expect(screen.getByRole('button', { name: 'Download in corso' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Scarica' })).toBeEnabled();
  });

  it('emptyList_showsEmptyState', () => {
    mockDownload();
    render(<PropertyDocumentsSection propertyId={PROPERTY_ID} documents={[]} />);

    expect(screen.getByText('Nessun documento caricato.')).toBeInTheDocument();
  });

  it('apeWithoutIdentification_editAndSave_sendsCodeAndClass', async () => {
    // LT-10: the contract states the APE code and energy class; they are entered on the APE document.
    mockDownload();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(propertyQueries.useUpdateApeIdentification).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof propertyQueries.useUpdateApeIdentification>);
    const ape: PropertyDocumentDto = {
      id: 'doc-ape',
      fileName: 'ape.pdf',
      fileType: 'pdf',
      documentType: 'Ape',
      uploadedAt: '2026-09-03T10:00:00Z',
      downloadUrl: `/api/properties/${PROPERTY_ID}/documents/doc-ape/download`,
      apeCode: null,
      apeEnergyClass: null,
    };
    render(<PropertyDocumentsSection propertyId={PROPERTY_ID} documents={[ape]} />);

    expect(screen.getByTestId('ape-identification-doc-ape')).toHaveTextContent(
      "Codice e classe energetica dell'APE non indicati",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Indica codice e classe' }));
    fireEvent.change(screen.getByLabelText('Codice APE'), { target: { value: ' 1510800012345 ' } });
    fireEvent.change(screen.getByLabelText('Classe energetica'), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await vi.waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        propertyId: PROPERTY_ID,
        docId: 'doc-ape',
        data: { code: '1510800012345', energyClass: 'b' },
      }),
    );
  });

  it('apeWithoutIdentification_readFromTheApe_asksTheServerToReadTheFile', () => {
    // The code and the class come from the file (and, for a code it does not show, from the register of the region): no typing.
    mockDownload();
    const mutate = mockRead();
    render(<PropertyDocumentsSection propertyId={PROPERTY_ID} documents={[APE_TO_IDENTIFY]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Leggi dall’APE' }));

    expect(mutate).toHaveBeenCalledWith({ propertyId: PROPERTY_ID, docId: 'doc-ape' });
  });

  it('apeWithoutIdentification_readFoundNothing_asksToEnterThem', () => {
    mockDownload();
    mockRead({ isSuccess: true });
    render(<PropertyDocumentsSection propertyId={PROPERTY_ID} documents={[APE_TO_IDENTIFY]} />);

    expect(screen.getByTestId('ape-identification-doc-ape')).toHaveTextContent('Codice e classe non si leggono nel documento: indicali tu.');
    expect(screen.queryByRole('button', { name: 'Leggi dall’APE' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indica codice e classe' })).toBeEnabled();
  });

  it('latestApeWithoutIdentification_isReadByItself_anOlderOneOnlyOnRequest', () => {
    // The latest APE is the one the contract states: nobody has to ask for its code and class.
    mockDownload();
    const older: PropertyDocumentDto = { ...APE_TO_IDENTIFY, id: 'doc-ape-old', uploadedAt: '2026-09-01T10:00:00Z' };
    render(<PropertyDocumentsSection propertyId={PROPERTY_ID} documents={[older, APE_TO_IDENTIFY]} />);

    expect(propertyQueries.useApeAutoRead).toHaveBeenCalledWith(PROPERTY_ID, APE_TO_IDENTIFY, true);
    expect(propertyQueries.useApeAutoRead).toHaveBeenCalledWith(PROPERTY_ID, older, false);
  });

  it('apeBeingReadByItself_saysSo_andOffersNoSecondReading', () => {
    mockDownload();
    mockAutoRead({ isFetching: true });
    render(<PropertyDocumentsSection propertyId={PROPERTY_ID} documents={[APE_TO_IDENTIFY]} />);

    expect(screen.getByRole('status')).toHaveTextContent('Leggo codice e classe dall’APE…');
    expect(screen.queryByRole('button', { name: 'Leggi dall’APE' })).not.toBeInTheDocument();
  });

  it('apeWithIdentification_offersToCorrectThem', () => {
    mockDownload();
    render(
      <PropertyDocumentsSection propertyId={PROPERTY_ID} documents={[{ ...APE_TO_IDENTIFY, apeCode: '1510800012345', apeEnergyClass: 'B' }]} />,
    );

    expect(screen.getByTestId('ape-identification-doc-ape')).toHaveTextContent('Codice 1510800012345 · classe energetica B');
    expect(screen.getByRole('button', { name: 'Correggi' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Leggi dall’APE' })).not.toBeInTheDocument();
  });
});
