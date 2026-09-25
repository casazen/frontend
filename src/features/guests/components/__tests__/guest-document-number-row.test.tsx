import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { guestsApi } from '@/api/guests.api';
import { GuestDocumentNumberRow } from '../guest-document-number-row';

vi.mock('@/api/guests.api', () => ({
  guestsApi: { getDocumentNumber: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const GUEST_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function renderRow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(GuestDocumentNumberRow, { guestId: GUEST_ID, masked: '*****5AB' }),
    ),
  );
}

describe('GuestDocumentNumberRow (CO-14)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('render_Initially_ShowsOnlyTheMaskedNumberAndDoesNotCallTheApi', () => {
    renderRow();

    expect(screen.getByTestId('guest-document-number')).toHaveTextContent('*****5AB');
    expect(guestsApi.getDocumentNumber).not.toHaveBeenCalled();
  });

  it('show_Clicked_AsksTheAuditedEndpointThenHideMasksAgain', async () => {
    vi.mocked(guestsApi.getDocumentNumber).mockResolvedValue({ guestId: GUEST_ID, documentNumber: 'CA12345AB' });
    renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Mostra' }));

    await waitFor(() => expect(screen.getByTestId('guest-document-number')).toHaveTextContent('CA12345AB'));
    expect(guestsApi.getDocumentNumber).toHaveBeenCalledWith(GUEST_ID);

    fireEvent.click(screen.getByRole('button', { name: 'Nascondi' }));

    expect(screen.getByTestId('guest-document-number')).toHaveTextContent('*****5AB');
  });

  it('show_ApiFails_KeepsTheMaskAndShowsAnError', async () => {
    vi.mocked(guestsApi.getDocumentNumber).mockRejectedValue(new Error('network'));
    renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Mostra' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Impossibile mostrare il numero di documento.'));
    expect(screen.getByTestId('guest-document-number')).toHaveTextContent('*****5AB');
  });
});
