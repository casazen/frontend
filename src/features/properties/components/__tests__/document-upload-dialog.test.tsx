import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { DocumentUploadDialog } from '../document-upload-dialog';

const upload = vi.hoisted(() => vi.fn());
vi.mock('@/queries/use-properties', () => ({ useUploadPropertyDocument: () => ({ mutateAsync: upload, isPending: false }) }));

describe('APE copy upload', () => {
  beforeEach(async () => { upload.mockReset(); upload.mockResolvedValue({ id: 'doc-ape' }); await i18n.changeLanguage('it'); });
  it('accepts a JPEG APE copy and describes archival without a claim of verified validity', async () => {
    render(<DocumentUploadDialog propertyId="house-1" defaultDocumentType="Ape" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.uploadDocument') }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe('.pdf,.jpg,.jpeg,.png');
    expect(screen.getByText(i18n.t('shared.documentUpload.apeScanNotice'))).toBeInTheDocument();
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'APE.jpeg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [photo] } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.upload') }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith({ propertyId: 'house-1', file: photo, documentType: 'Ape' }));
  });
});
