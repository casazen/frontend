import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { gdprApi } from '@/api/gdpr.api';
import { GdprTab } from '../gdpr-tab';
import type { Guest, GuestPrivacySummary } from '@/types';

vi.mock('@/api/gdpr.api', () => ({
  gdprApi: {
    getSummary: vi.fn(),
    exportData: vi.fn(),
    deleteData: vi.fn(),
    anonymizeData: vi.fn(),
    withdrawMarketingConsent: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const GUEST_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

const guest = {
  id: GUEST_ID,
  firstName: 'Giulia',
  lastName: 'Bianchi',
  dataProcessingPurpose: 'Alloggiati Web guest registration (TULPS Art. 109)',
  marketingConsent: true,
  erasureRequested: false,
  isDeleted: false,
} as Guest;

const summary: GuestPrivacySummary = {
  guestId: GUEST_ID,
  marketing: { granted: true, since: '2026-09-02T10:00:00Z', version: 'marketing-2026-09' },
  privacyNotice: { version: 'notice-2026-09', presentedAt: '2026-09-02T10:00:00Z' },
  consentHistory: [
    { purpose: 'PrivacyNotice', action: 'NoticePresented', version: 'notice-2026-09', source: 'GuestPortal', recordedAt: '2026-09-02T10:00:00Z' },
    { purpose: 'Marketing', action: 'Granted', version: 'marketing-2026-09', source: 'GuestPortal', recordedAt: '2026-09-02T10:00:00Z' },
  ],
  retention: [
    { category: 'DocumentScans', configured: true, days: 30, source: 'Decisione PO 2026-10', referenceDate: '2026-09-05T00:00:00Z', dueDate: '2026-10-06T00:00:00Z' },
    { category: 'AlloggiatiData', configured: false },
    { category: 'Marketing', configured: false },
    { category: 'FiscalData', configured: true, years: 10, source: 'gdpr.md § 5', referenceDate: '2026-09-05T00:00:00Z', dueDate: '2036-09-06T00:00:00Z' },
  ],
  isDeleted: false,
  hasDocumentScan: true,
  hasOpenBookings: false,
};

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(GdprTab, { guest })));
}

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

describe('GdprTab (CO-15)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(gdprApi.getSummary).mockResolvedValue(summary);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('marketing_grantedByTheGuest_showsVersionAndOffersOnlyTheWithdrawal', async () => {
    renderTab();

    expect(await screen.findByTestId('gdpr-marketing-state')).toHaveTextContent('Dato dall’ospite il 02/09/2026 (testo versione marketing-2026-09)');
    const marketing = screen.getByTestId('gdpr-marketing');
    expect(within(marketing).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(marketing).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(marketing).toHaveTextContent('Solo l’ospite può dare il consenso marketing');
    expect(screen.getByTestId('gdpr-marketing-withdraw')).toHaveTextContent('Revoca su richiesta dell’ospite');
  });

  it('marketing_notGranted_hasNoControlToGrantIt', async () => {
    vi.mocked(gdprApi.getSummary).mockResolvedValue({ ...summary, marketing: { granted: false, version: '' } });
    renderTab();

    expect(await screen.findByTestId('gdpr-marketing-state')).toHaveTextContent('Non dato');
    expect(screen.queryByTestId('gdpr-marketing-withdraw')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('withdraw_requiresTheGuestRequestNoteThenSendsIt', async () => {
    vi.mocked(gdprApi.withdrawMarketingConsent).mockResolvedValue(undefined);
    renderTab();

    fireEvent.click(await screen.findByTestId('gdpr-marketing-withdraw'));
    const confirm = await screen.findByTestId('gdpr-marketing-withdraw-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Richiesta dell’ospite'), { target: { value: '  Email del 02/09/2026  ' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(gdprApi.withdrawMarketingConsent).toHaveBeenCalledWith(GUEST_ID, 'Email del 02/09/2026'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Consenso marketing revocato'));
    expect(gdprApi.getSummary).toHaveBeenCalledTimes(2);
  });

  it('withdraw_apiRefuses_showsTheServerProblem', async () => {
    vi.mocked(gdprApi.withdrawMarketingConsent).mockRejectedValue(
      problem(422, { code: 'gdpr_marketing_withdrawal_note_required', detail: 'Indica la richiesta dell’ospite (data e canale).' }),
    );
    renderTab();

    fireEvent.click(await screen.findByTestId('gdpr-marketing-withdraw'));
    fireEvent.change(await screen.findByLabelText('Richiesta dell’ospite'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('gdpr-marketing-withdraw-confirm'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Indica la richiesta dell’ospite (data e canale).'));
  });

  it('consentHistory_listsEveryEventWithItsVersion', async () => {
    renderTab();

    const history = await screen.findByTestId('gdpr-consent-history');
    expect(history).toHaveTextContent('Informativa mostrata · Informativa privacy · versione notice-2026-09 · dall’ospite nel portale del check-in');
    expect(history).toHaveTextContent('Consenso dato · Consenso marketing · versione marketing-2026-09');
    expect(screen.getByTestId('gdpr-privacy-notice')).toHaveTextContent('Versione notice-2026-09 del 02/09/2026');
  });

  it('retention_showsEachCategoryWithPeriodAndSourceOrNotConfigured', async () => {
    renderTab();

    expect(await screen.findByTestId('gdpr-retention-DocumentScans')).toHaveTextContent('30 giorni – fonte: Decisione PO 2026-10');
    expect(screen.getByTestId('gdpr-retention-DocumentScans')).toHaveTextContent('Applicata dal 06/10/2026');
    expect(screen.getByTestId('gdpr-retention-FiscalData')).toHaveTextContent('10 anni – fonte: gdpr.md § 5');
    expect(screen.getByTestId('gdpr-retention-AlloggiatiData')).toHaveTextContent('Periodo non configurato: nessuna cancellazione automatica');
    expect(screen.getByTestId('gdpr-retention-Marketing')).toHaveTextContent('Periodo non configurato');
  });

  it('openBookings_disablesErasureAndAnonymizationWithTheReason', async () => {
    vi.mocked(gdprApi.getSummary).mockResolvedValue({ ...summary, hasOpenBookings: true });
    renderTab();

    expect(await screen.findByTestId('gdpr-open-bookings')).toHaveTextContent('prenotazioni in corso o future');
    expect(screen.getByTestId('gdpr-delete-button')).toBeDisabled();
    expect(screen.getByTestId('gdpr-anonymize-button')).toBeDisabled();
    expect(screen.getByTestId('gdpr-export-button')).toBeEnabled();
  });

  it('summary_apiError_showsTheErrorAndRetryNotAnEmptyTab', async () => {
    vi.mocked(gdprApi.getSummary).mockRejectedValue(new Error('network'));
    renderTab();

    expect(await screen.findByTestId('gdpr-error')).toHaveTextContent('Impossibile caricare i dati GDPR dell’ospite.');
    expect(screen.queryByTestId('gdpr-retention')).not.toBeInTheDocument();
    vi.mocked(gdprApi.getSummary).mockResolvedValue(summary);
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('gdpr-retention')).toBeInTheDocument();
  });
});
