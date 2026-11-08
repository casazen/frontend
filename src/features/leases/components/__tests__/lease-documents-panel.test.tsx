import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { leaseDocumentsApi } from '@/api/lease-documents.api';
import { LeaseDocumentsPanel } from '../lease-documents-panel';

vi.mock('@/api/lease-documents.api', () => ({
  leaseDocumentsApi: {
    list: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
    upload: vi.fn(),
    readReceipt: vi.fn(),
  },
}));

const document = {
  id: 'doc-1',
  leaseId: 'lease-1',
  kind: 'Contract' as const,
  fileName: 'contratto.pdf',
  sizeBytes: 1200,
  uploadedAt: '2026-11-01T10:00:00Z',
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LeaseDocumentsPanel leaseId="lease-1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Lease documents panel', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(leaseDocumentsApi.list).mockResolvedValue([document]);
    vi.mocked(leaseDocumentsApi.remove).mockResolvedValue();
  });

  it('keeps download and deletes an uploaded file only after confirmation', async () => {
    renderPanel();

    expect(await screen.findByRole('button', { name: 'Scarica' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('lease-document-delete-doc-1'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Eliminare questo documento?');
    expect(dialog).toHaveTextContent('contratto.pdf');
    expect(leaseDocumentsApi.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(leaseDocumentsApi.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('lease-document-delete-doc-1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina' }));

    await waitFor(() => expect(leaseDocumentsApi.remove).toHaveBeenCalledWith('lease-1', 'doc-1'));
    expect(screen.getByRole('button', { name: 'Scarica' })).toBeInTheDocument();
  });

  it('keeps the dialog open and says why when the API refuses the delete', async () => {
    vi.mocked(leaseDocumentsApi.remove).mockRejectedValue(new Error('refused'));
    renderPanel();

    fireEvent.click(await screen.findByTestId('lease-document-delete-doc-1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina' }));

    expect(await screen.findByTestId('lease-document-delete-error')).toHaveTextContent('Impossibile eliminare il documento.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('contratto.pdf')).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
