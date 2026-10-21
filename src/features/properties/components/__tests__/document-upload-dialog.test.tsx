import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { DocumentUploadDialog } from '../document-upload-dialog';

const upload = vi.hoisted(() => vi.fn());
vi.mock('@/queries/use-properties', () => ({ useUploadPropertyDocument: () => ({ mutateAsync: upload, isPending: false }) }));

describe('APE document upload', () => {
  beforeEach(async () => { upload.mockReset(); upload.mockResolvedValue({ id: 'doc-ape' }); await i18n.changeLanguage('it'); });
  it('submits a complete PDF for server OCR and explains fundamental checks', async () => {
    render(<DocumentUploadDialog propertyId="house-1" defaultDocumentType="Ape" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.uploadDocument') }));
    const input = screen.getByLabelText(i18n.t('documentPages.select'));
    expect(input).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png');
    expect(input).toHaveAttribute('multiple');
    expect(screen.getByText(i18n.t('shared.documentUpload.apeScanNotice'))).toBeInTheDocument();
    const pdf = new File(['%PDF-1.7'], 'APE.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [pdf] } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.upload') }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith({ propertyId: 'house-1', file: pdf, documentType: 'Ape' }));
  });
});
