import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import { ComoStayTourReport } from '../como-staytour-report';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/features/compliance/components/proof-upload-dialog', () => ({
  ProofUploadDialog: ({ prefill }: { prefill: { period: string; kind: string; propertyId: string } }) =>
    <output>{[prefill.propertyId, prefill.period, prefill.kind].join('/')}</output>,
}));

describe('Como StayTour declaration', () => {
  beforeEach(async () => { await i18n.changeLanguage('it'); });
  afterEach(cleanup);
  it('reads the selected property and month and archives the declaration separately from the payment', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue({
      taxableGuests: 2, taxableGuestNights: 4, hostTax: 8, unconfirmedStays: 1,
      departuresToReview: 1, channelStaysToReconcile: 0, exemptions: { over_four_nights: { guests: 1, guestNights: 1 } },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<I18nextProvider i18n={i18n}><QueryClientProvider client={client}><MemoryRouter>
      <ComoStayTourReport propertyId="p1" propertyName="Prova" />
    </MemoryRouter></QueryClientProvider></I18nextProvider>);
    fireEvent.change(screen.getByLabelText('Mese della dichiarazione'), { target: { value: '2024-11' } });
    await waitFor(() => expect(ApiClient.get).toHaveBeenCalledWith('/properties/p1/staytour/como/2024-11'));
    expect(await screen.findByText('Pernottamenti successivi al quarto')).toBeInTheDocument();
    expect(screen.getByText(/Soggiorni da riconciliare per data di uscita/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Consulta le conferme del mese' })).toHaveAttribute('href', expect.stringContaining('kind=TouristTaxDeclaration'));
    fireEvent.click(screen.getByRole('button', { name: 'Archivia la conferma di StayTour' }));
    expect(screen.getByText('p1/2024-11/TouristTaxDeclaration')).toBeInTheDocument();
  });
});
