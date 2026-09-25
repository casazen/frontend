import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { fiscalApi, type FiscalTaxProfile } from '@/api/fiscal.api';
import { FiscalWizardPage } from '../fiscal-wizard-page';

vi.mock('@/api/fiscal.api', () => ({
  fiscalApi: { getTaxProfile: vi.fn(), putTaxProfile: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const savedWithoutVat: FiscalTaxProfile = {
  hasPartitaIva: false,
  partitaIvaNumber: null,
  fiscalCode: 'RSSMRA80A01H501U',
  fiscalDataRetentionUntil: null,
};

const savedWithVat: FiscalTaxProfile = {
  hasPartitaIva: true,
  partitaIvaNumber: '12345678901',
  fiscalCode: 'RSSMRA80A01H501U',
  fiscalDataRetentionUntil: '2036-12-31T00:00:00Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ['/app/short-rent/fiscal/wizard'] },
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/app/short-rent/fiscal/wizard', element: createElement(FiscalWizardPage) }),
          createElement(Route, { path: '/app/short-rent/fiscal', element: createElement('p', null, 'dashboard') }),
        ),
      ),
    ),
  );
}

describe('FiscalWizardPage (CO-19)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('FiscalWizard_SavedProfileWithoutVat_IsPrefilledNotDefaultedToVat', async () => {
    vi.mocked(fiscalApi.getTaxProfile).mockResolvedValueOnce(savedWithoutVat);

    renderPage();

    const checkbox = await screen.findByTestId('fiscal-has-piva');
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByTestId('fiscal-piva-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('fiscal-cf-input')).toHaveValue('RSSMRA80A01H501U');
    expect(screen.getByTestId('fiscal-wizard-save')).toBeDisabled();
    expect(screen.getByTestId('fiscal-wizard-no-changes')).toBeInTheDocument();
  });

  it('FiscalWizard_SavedProfileWithVat_ShowsTheSavedNumber', async () => {
    vi.mocked(fiscalApi.getTaxProfile).mockResolvedValueOnce(savedWithVat);

    renderPage();

    expect(await screen.findByTestId('fiscal-piva-input')).toHaveValue('12345678901');
    expect(screen.getByTestId('fiscal-has-piva')).toBeChecked();
  });

  it('FiscalWizard_OnlyFiscalCodeChanged_SendsOnlyTheFiscalCode', async () => {
    vi.mocked(fiscalApi.getTaxProfile).mockResolvedValue(savedWithVat);
    vi.mocked(fiscalApi.putTaxProfile).mockResolvedValueOnce({ ...savedWithVat, fiscalCode: 'VRDLGU75B12F205X' });

    renderPage();
    fireEvent.change(await screen.findByTestId('fiscal-cf-input'), { target: { value: 'vrdlgu75b12f205x' } });
    fireEvent.click(screen.getByTestId('fiscal-wizard-save'));

    await waitFor(() => expect(fiscalApi.putTaxProfile).toHaveBeenCalledTimes(1));
    // The saved partita IVA is neither sent nor overwritten.
    expect(vi.mocked(fiscalApi.putTaxProfile).mock.calls[0][0]).toEqual({ fiscalCode: 'VRDLGU75B12F205X' });
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(i18n.t('fiscal.wizard.saved'));
  });

  it('FiscalWizard_EnableVat_SendsTheFlagAndTheNumber', async () => {
    vi.mocked(fiscalApi.getTaxProfile).mockResolvedValue(savedWithoutVat);
    vi.mocked(fiscalApi.putTaxProfile).mockResolvedValueOnce(savedWithVat);

    renderPage();
    fireEvent.click(await screen.findByTestId('fiscal-has-piva'));
    fireEvent.change(screen.getByTestId('fiscal-piva-input'), { target: { value: '123 456 789 01' } });
    fireEvent.click(screen.getByTestId('fiscal-wizard-save'));

    await waitFor(() =>
      expect(fiscalApi.putTaxProfile).toHaveBeenCalledWith({ hasPartitaIva: true, partitaIvaNumber: '12345678901' }),
    );
  });

  it('FiscalWizard_InvalidVatNumber_ShowsTheErrorAndDoesNotSave', async () => {
    vi.mocked(fiscalApi.getTaxProfile).mockResolvedValueOnce(savedWithoutVat);

    renderPage();
    fireEvent.click(await screen.findByTestId('fiscal-has-piva'));
    fireEvent.change(screen.getByTestId('fiscal-piva-input'), { target: { value: '1234' } });
    fireEvent.click(screen.getByTestId('fiscal-wizard-save'));

    expect(await screen.findByTestId('fiscal-piva-error')).toHaveTextContent(i18n.t('fiscal.wizard.pivaInvalid'));
    expect(fiscalApi.putTaxProfile).not.toHaveBeenCalled();
  });

  it('FiscalWizard_SaveRejected_ShowsTheApiProblem', async () => {
    vi.mocked(fiscalApi.getTaxProfile).mockResolvedValue(savedWithVat);
    vi.mocked(fiscalApi.putTaxProfile).mockRejectedValueOnce(
      new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { status: 400, code: 'fiscal_tax_identifier_invalid', detail: 'Partita IVA o codice fiscale non validi.' },
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByTestId('fiscal-has-piva'));
    fireEvent.click(screen.getByTestId('fiscal-wizard-save'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Partita IVA o codice fiscale non validi.'));
    expect(fiscalApi.putTaxProfile).toHaveBeenCalledWith({ hasPartitaIva: false });
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
  });

  it('FiscalWizard_ProfileLoadFails_ShowsErrorInsteadOfAnEmptyForm', async () => {
    vi.mocked(fiscalApi.getTaxProfile)
      .mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
      .mockResolvedValueOnce(savedWithoutVat);

    renderPage();

    const error = await screen.findByTestId('fiscal-wizard-error');
    expect(screen.queryByTestId('fiscal-wizard-form')).not.toBeInTheDocument();
    fireEvent.click(within(error).getByRole('button', { name: i18n.t('fiscal.retry') }));
    expect(await screen.findByTestId('fiscal-cf-input')).toHaveValue('RSSMRA80A01H501U');
  });
});
