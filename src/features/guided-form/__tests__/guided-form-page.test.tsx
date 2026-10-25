import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { CfSimulatorApi } from '@/api/cf-simulator.api';
import { httpError } from '@/features/leases/__tests__/lease-test-utils';
import type { CfSimulatorCreatedPractice, CfSimulatorLinkResponse } from '@/types/cf-simulator.types';
import { GuidedFormPage } from '../guided-form-page';
import { savePractice } from '../lib/guided-form-link';

// CF-SIM: the module of the service that prepares the contract, simulated for the test environments. It checks the signed link, takes the
// practice in, and leads back into CasaZen; where the simulator is off the API answers 404 and the page says it is not available.
vi.mock('@/api/cf-simulator.api', () => ({
  CfSimulatorApi: { checkLink: vi.fn(), createPractice: vi.fn(), setStatus: vi.fn(), downloadDocument: vi.fn() },
}));

const checkLink = vi.mocked(CfSimulatorApi.checkLink);
const createPractice = vi.mocked(CfSimulatorApi.createPractice);

const LEASE_ID = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const PRACTICE_ID = 'P-0123456789abcdef';
const SIGNED_LINK = `/guided-form?partner=casazen&leaseId=${LEASE_ID}&expiresAt=2026-10-13T10%3A00%3A00Z&signature=abc123&comune=Monza&provincia=MB`;

function linkResponse(overrides: Partial<CfSimulatorLinkResponse> = {}): CfSimulatorLinkResponse {
  return { valid: true, reason: null, leaseId: LEASE_ID, comune: 'Monza', provincia: 'MB', practices: [], ...overrides };
}

function created(overrides: Partial<CfSimulatorCreatedPractice> = {}): CfSimulatorCreatedPractice {
  return {
    practiceId: PRACTICE_ID,
    controlToken: 'control-token',
    status: 'Received',
    statusChangedAt: '2026-10-13T09:50:00Z',
    linked: true,
    ...overrides,
  };
}

function SearchProbe() {
  return <p data-testid="search">{useLocation().search}</p>;
}

function renderPage(path = SIGNED_LINK) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SearchProbe />
        <Routes>
          <Route path="/guided-form" element={<GuidedFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GuidedFormPage (CF-SIM)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('render_GoodLink_ShowsTheTestNoticeAndTheMunicipality_AndSendingGivesThePracticeAndTheWayBackIntoCasaZen', async () => {
    checkLink.mockResolvedValue(linkResponse());
    createPractice.mockResolvedValue(created());

    renderPage();

    expect(await screen.findByTestId('guided-form-link-valid')).toHaveTextContent('Collegamento valido');
    expect(screen.getByTestId('guided-form-test-notice')).toHaveTextContent('Ambiente di prova');
    expect(screen.getByTestId('guided-form-comune')).toHaveTextContent('Monza');
    expect(screen.getByTestId('guided-form-provincia')).toHaveTextContent('MB');
    expect(checkLink).toHaveBeenCalledWith(expect.objectContaining({ partner: 'casazen', leaseId: LEASE_ID, signature: 'abc123' }));
    // The signed parameters leave the address as soon as they are read; the municipality is not secret.
    await waitFor(() => expect(screen.getByTestId('search')).not.toHaveTextContent('signature'));
    expect(screen.getByTestId('search')).not.toHaveTextContent(LEASE_ID);
    expect(screen.getByTestId('search')).toHaveTextContent('comune=Monza');

    fireEvent.click(screen.getByTestId('guided-form-submit'));

    expect(await screen.findByTestId('guided-form-practice-id')).toHaveTextContent(PRACTICE_ID);
    expect(createPractice).toHaveBeenCalledWith(expect.objectContaining({ leaseId: LEASE_ID, signature: 'abc123' }));
    expect(screen.getByTestId('cf-status-badge')).toHaveAttribute('data-status', 'Received');
    expect(screen.getByTestId('guided-form-linked')).toHaveTextContent('collegata al contratto');
    expect(screen.getByTestId('guided-form-upload')).toHaveAttribute('href', `/app/long-rent/documents/upload?practice=${PRACTICE_ID}`);
    expect(screen.getByTestId('guided-form-back')).toHaveAttribute('href', `/app/long-rent/leases/${LEASE_ID}`);
    expect(screen.getByTestId('guided-form-panel')).toBeInTheDocument();
  });

  it('render_LinkThatIsNotGood_SaysSoAndStillLetsThePracticeBeSentWithoutAWayBackToAContract', async () => {
    checkLink.mockResolvedValue(linkResponse({ valid: false, reason: 'expired', leaseId: null }));
    createPractice.mockResolvedValue(created({ linked: false }));

    renderPage();

    expect(await screen.findByTestId('guided-form-link-invalid')).toHaveTextContent('non è valido o è scaduto');
    expect(screen.queryByTestId('guided-form-link-valid')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('guided-form-submit'));

    expect(await screen.findByTestId('guided-form-linked')).toHaveTextContent('senza riferimento al contratto');
    expect(screen.getByTestId('guided-form-upload')).toBeInTheDocument();
    expect(screen.queryByTestId('guided-form-back')).not.toBeInTheDocument();
  });

  it('render_ReloadWithoutTheSignedParameters_GivesBackThePracticeSentFromThisTab_AndAsksNothing', async () => {
    savePractice({ practiceId: PRACTICE_ID, controlToken: 'control-token', status: 'Attested', linked: true, leaseId: LEASE_ID });

    renderPage('/guided-form?partner=casazen&comune=Monza&provincia=MB');

    expect(await screen.findByTestId('guided-form-practice-id')).toHaveTextContent(PRACTICE_ID);
    expect(screen.getByTestId('cf-status-badge')).toHaveAttribute('data-status', 'Attested');
    expect(checkLink).not.toHaveBeenCalled();
  });

  it('render_SimulatorOff_SaysThePageIsNotAvailableAndShowsNothingOfTheTest', async () => {
    checkLink.mockRejectedValue(httpError(404));

    renderPage();

    expect(await screen.findByTestId('guided-form-unavailable')).toHaveTextContent('Pagina non disponibile');
    expect(screen.queryByTestId('guided-form-test-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guided-form-submit')).not.toBeInTheDocument();
  });
});
