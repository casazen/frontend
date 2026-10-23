import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { DocumentUploadDialog } from '../document-upload-dialog';

const upload = vi.hoisted(() => vi.fn());
const identify = vi.hoisted(() => vi.fn());
vi.mock('@/queries/use-properties', () => ({
  useUploadPropertyDocument: () => ({ mutateAsync: upload, isPending: false }),
  useUpdateApeIdentification: () => ({ mutateAsync: identify, isPending: false }),
  useReadApeIdentification: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }),
  useApeAutoRead: () => ({ isFetching: false, isSuccess: false }),
}));

const APE = { id: 'doc-ape', fileName: 'APE.pdf', fileType: 'pdf', documentType: 'Ape', uploadedAt: '2026-10-23T10:00:00Z', downloadUrl: '' };

function openApeDialog() {
  render(<DocumentUploadDialog propertyId="house-1" defaultDocumentType="Ape" />);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.uploadDocument') }));
  const pdf = new File(['%PDF-1.7'], 'APE.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText(i18n.t('documentPages.select')), { target: { files: [pdf] } });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.upload') }));
  return pdf;
}

describe('APE document upload', () => {
  beforeEach(async () => {
    upload.mockReset();
    upload.mockResolvedValue({ ...APE, apeCheck: 'Verified', apeUnreadFields: [] });
    identify.mockReset();
    identify.mockResolvedValue({ ...APE, apeCode: '1610800012345/17', apeEnergyClass: 'F' });
    await i18n.changeLanguage('it');
  });

  it('submits a complete PDF for server OCR and explains fundamental checks', async () => {
    render(<DocumentUploadDialog propertyId="house-1" defaultDocumentType="Ape" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.uploadDocument') }));
    const input = screen.getByLabelText(i18n.t('documentPages.select'));
    expect(input).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png');
    expect(input).toHaveAttribute('multiple');
    // The window has a place to drop the files on, not only the button of the browser.
    expect(screen.getByTestId('document-drop-zone')).toHaveTextContent(i18n.t('documentPages.dropHere'));
    expect(screen.getByText(i18n.t('shared.documentUpload.apeScanNotice'))).toBeInTheDocument();
    const pdf = new File(['%PDF-1.7'], 'APE.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [pdf] } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.upload') }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith({ propertyId: 'house-1', file: pdf, documentType: 'Ape' }));
  });

  it('keeps an APE the reader could not read whole and asks for its code and class right there', async () => {
    upload.mockResolvedValue({ ...APE, apeCheck: 'Incomplete', apeUnreadFields: ['codice identificativo dell’attestato', 'data di scadenza valida'] });

    openApeDialog();

    expect(await screen.findByTestId('ape-check-Incomplete')).toHaveTextContent(
      'Dalle pagine non siamo riusciti a leggere: codice identificativo dell’attestato, data di scadenza valida.',
    );
    fireEvent.change(screen.getByLabelText(i18n.t('property.documents.apeCode')), { target: { value: '1610800012345/17' } });
    fireEvent.change(screen.getByLabelText(i18n.t('property.documents.apeEnergyClass')), { target: { value: 'F' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.documents.apeIdentificationSave') }));

    await waitFor(() =>
      expect(identify).toHaveBeenCalledWith({ propertyId: 'house-1', docId: 'doc-ape', data: { code: '1610800012345/17', energyClass: 'F' } }),
    );
    await waitFor(() => expect(screen.queryByTestId('ape-saved')).not.toBeInTheDocument());
  });

  it('says the code and the class it read, and where the code came from, with nothing to type', async () => {
    // A photocopy whose code is not legible: the class from the file, the code from the register of the region (CENED).
    upload.mockResolvedValue({
      ...APE,
      apeCheck: 'Verified',
      apeUnreadFields: [],
      apeCode: '1610800012345/17',
      apeEnergyClass: 'F',
      apeIdentificationSource: 'Registry',
    });

    openApeDialog();

    expect(await screen.findByTestId('ape-identified')).toHaveTextContent(
      i18n.t('shared.documentUpload.apeReadRegistry', { code: '1610800012345/17', energyClass: 'F' }),
    );
    expect(screen.queryByLabelText(i18n.t('property.documents.apeCode'))).not.toBeInTheDocument();
    // Nothing left to type: the window does not say "type them as printed".
    expect(screen.getByText(i18n.t('shared.documentUpload.apeDataReadDescription'))).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ape-saved-done'));

    await waitFor(() => expect(screen.queryByTestId('ape-saved')).not.toBeInTheDocument());
    expect(identify).not.toHaveBeenCalled();
  });

  it('says inside the window why the server refused the file, keeping the pages chosen', async () => {
    const refused = new AxiosError('Request failed', 'ERR_BAD_REQUEST', { headers: new AxiosHeaders() }, null, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { status: 400, code: 'APE_INVALID_CONTENT', detail: 'La data di scadenza letta nell’APE è trascorsa.' },
    });
    upload.mockRejectedValue(refused);

    openApeDialog();

    expect(await screen.findByTestId('document-upload-error')).toHaveTextContent('La data di scadenza letta nell’APE è trascorsa.');
    expect(screen.getByText(/APE\.pdf/)).toBeInTheDocument();
  });
});
