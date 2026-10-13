import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { touristTaxApi } from '@/api/tourist-tax.api';
import type { TouristTaxRate } from '@/types';
import { AdminTaxRatesPage } from '../admin-tax-rates-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/tourist-tax.api', () => ({
  touristTaxApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
}));

const milano: TouristTaxRate = {
  id: 'rate-milano',
  city: 'Milano',
  istatCode: '015146',
  regionCode: 'LOM',
  accommodationCategory: null,
  seasonStart: null,
  seasonEnd: null,
  calculationMethod: 'PerPersonPerNight',
  ratePerPersonPerNight: 9.5,
  percentOfNightlyPrice: null,
  capPerPersonPerNight: null,
  maxNights: 14,
  minimumAge: 18,
  reducedRateMaxAge: null,
  reducedRatePerPersonPerNight: null,
  isActive: true,
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveTo: null,
  notes: 'Locazioni brevi',
  sourceUrl: 'https://www.comune.milano.it/tariffe-2026',
  verificationLevel: 'Official',
  createdAt: '2026-09-23T00:00:00Z',
  updatedAt: '2026-09-23T00:00:00Z',
};

const manual: TouristTaxRate = {
  ...milano,
  id: 'rate-lecco',
  city: 'Lecco',
  sourceUrl: null,
  verificationLevel: null,
};

function problemError(status: number, data: object): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, ...data },
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(AdminTaxRatesPage)));
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

describe('AdminTaxRatesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(touristTaxApi.getAll).mockResolvedValue([milano, manual]);
  });

  it('render_Rates_ShowsSourceLinkAndVerificationLevel', async () => {
    renderPage();

    const source = await screen.findByTestId('tax-rate-source-rate-milano');
    expect(within(source).getByRole('link')).toHaveAttribute('href', 'https://www.comune.milano.it/tariffe-2026');
    expect(source).toHaveTextContent('comune.milano.it');
    expect(screen.getByTestId('tax-rate-verification-rate-milano')).toHaveTextContent('Ufficiale (U)');
    expect(screen.getByTestId('tax-rate-source-rate-lecco')).toHaveTextContent('Non indicata');
    expect(screen.getByTestId('tax-rate-verification-rate-lecco')).toHaveTextContent('Non indicata');
    expect(screen.getAllByText('01/01/2026')).toHaveLength(2);
  });

  it('render_LoadError_ShowsErrorNotEmptyList', async () => {
    vi.mocked(touristTaxApi.getAll).mockRejectedValue(problemError(500, {}));

    renderPage();

    expect(await screen.findByText('Impossibile caricare le aliquote fiscali.')).toBeInTheDocument();
    expect(screen.queryByText('Nessuna aliquota configurata')).not.toBeInTheDocument();
  });

  it('create_ValidForm_SendsBodyWithoutIdAndWithDateOnlyValues', async () => {
    vi.mocked(touristTaxApi.create).mockResolvedValue({ ...manual, id: 'new-id' });
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getByRole('button', { name: 'Nuova aliquota' }));
    fireEvent.change(dialog().getByLabelText('Città *'), { target: { value: 'Lecco' } });
    fireEvent.change(dialog().getByLabelText('Regione *'), { target: { value: 'LOM' } });
    fireEvent.change(dialog().getByLabelText('Tariffa per notte *'), { target: { value: '1.5' } });
    fireEvent.change(dialog().getByLabelText('In vigore dal *'), { target: { value: '2027-01-01' } });
    fireEvent.change(dialog().getByLabelText('Fonte'), { target: { value: 'https://www.comune.lecco.it/imposta' } });
    fireEvent.change(dialog().getByLabelText('Verifica'), { target: { value: 'ThirdParty' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Crea' }));

    await waitFor(() => expect(touristTaxApi.create).toHaveBeenCalledTimes(1));
    const body = vi.mocked(touristTaxApi.create).mock.calls[0][0];
    expect(body).not.toHaveProperty('id');
    expect(body).toMatchObject({
      city: 'Lecco',
      regionCode: 'LOM',
      ratePerPersonPerNight: 1.5,
      maxNights: null,
      minimumAge: 14,
      effectiveFrom: '2027-01-01',
      effectiveTo: null,
      sourceUrl: 'https://www.comune.lecco.it/imposta',
      verificationLevel: 'ThirdParty',
      isActive: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Aliquota creata con successo');
  });

  it('create_PercentageRateWithSeason_SendsPercentCapAndSeasonWithoutFixedAmount', async () => {
    vi.mocked(touristTaxApi.create).mockResolvedValue({ ...manual, id: 'new-id' });
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getByRole('button', { name: 'Nuova aliquota' }));
    fireEvent.change(dialog().getByLabelText('Città *'), { target: { value: 'Rimini' } });
    fireEvent.change(dialog().getByLabelText('Regione *'), { target: { value: 'EMR' } });
    fireEvent.change(dialog().getByLabelText('Tipo di tariffa *'), { target: { value: 'PercentOfNightlyPrice' } });
    fireEvent.change(await dialog().findByLabelText('Percentuale del prezzo (%) *'), { target: { value: '5.5' } });
    fireEvent.change(dialog().getByLabelText('Tetto per persona per notte (€)'), { target: { value: '3' } });
    fireEvent.change(dialog().getByLabelText('Stagione dal (MM-GG)'), { target: { value: '06-01' } });
    fireEvent.change(dialog().getByLabelText('Stagione al (MM-GG)'), { target: { value: '09-30' } });
    fireEvent.change(dialog().getByLabelText('In vigore dal *'), { target: { value: '2027-01-01' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Crea' }));

    await waitFor(() => expect(touristTaxApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(touristTaxApi.create).mock.calls[0][0]).toMatchObject({
      city: 'Rimini',
      calculationMethod: 'PercentOfNightlyPrice',
      ratePerPersonPerNight: 0,
      percentOfNightlyPrice: 5.5,
      capPerPersonPerNight: 3,
      seasonStart: '06-01',
      seasonEnd: '09-30',
      reducedRateMaxAge: null,
    });
  });

  it('create_SeasonWithOneBound_ShowsSeasonErrorAndSendsNothing', async () => {
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getByRole('button', { name: 'Nuova aliquota' }));
    fireEvent.change(dialog().getByLabelText('Città *'), { target: { value: 'Lecco' } });
    fireEvent.change(dialog().getByLabelText('Regione *'), { target: { value: 'LOM' } });
    fireEvent.change(dialog().getByLabelText('Stagione dal (MM-GG)'), { target: { value: '02-01' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Crea' }));

    expect(await dialog().findByText(/Indica inizio e fine stagione/)).toBeInTheDocument();
    expect(touristTaxApi.create).not.toHaveBeenCalled();
  });

  it('create_ApiValidationError_ShowsServerMessageAndKeepsDialogOpen', async () => {
    vi.mocked(touristTaxApi.create).mockRejectedValue(
      problemError(400, {
        code: 'validation_error',
        errors: { SourceUrl: ['La fonte deve essere un indirizzo web completo (http o https) di al massimo 500 caratteri.'] },
      }),
    );
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getByRole('button', { name: 'Nuova aliquota' }));
    fireEvent.change(dialog().getByLabelText('Città *'), { target: { value: 'Lecco' } });
    fireEvent.change(dialog().getByLabelText('Regione *'), { target: { value: 'LOM' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Crea' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'La fonte deve essere un indirizzo web completo (http o https) di al massimo 500 caratteri.',
      ),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(dialog().getByLabelText('Città *')).toHaveValue('Lecco');
  });

  it('create_EndBeforeStartAndEmptyMaxNights_ShowsFieldErrorOnlyForTheEndDate', async () => {
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getByRole('button', { name: 'Nuova aliquota' }));
    fireEvent.change(dialog().getByLabelText('Città *'), { target: { value: 'Lecco' } });
    fireEvent.change(dialog().getByLabelText('Regione *'), { target: { value: 'LOM' } });
    fireEvent.change(dialog().getByLabelText('In vigore dal *'), { target: { value: '2027-06-01' } });
    fireEvent.change(dialog().getByLabelText('Data fine validità'), { target: { value: '2027-01-01' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Crea' }));

    expect(await dialog().findByText('La data di fine validità non può precedere la data di inizio')).toBeInTheDocument();
    expect(touristTaxApi.create).not.toHaveBeenCalled();
  });

  it('update_EditExistingRate_PrefillsFormAndSendsPutWithTheRateId', async () => {
    vi.mocked(touristTaxApi.update).mockResolvedValue({ ...milano, ratePerPersonPerNight: 10 });
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getAllByTitle('Modifica')[0]);
    expect(dialog().getByLabelText('Città *')).toHaveValue('Milano');
    expect(dialog().getByLabelText('In vigore dal *')).toHaveValue('2026-01-01');
    expect(dialog().getByLabelText('Fonte')).toHaveValue('https://www.comune.milano.it/tariffe-2026');
    expect(dialog().getByLabelText('Verifica')).toHaveValue('Official');

    fireEvent.change(dialog().getByLabelText('Tariffa per notte *'), { target: { value: '10' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Aggiorna' }));

    await waitFor(() => expect(touristTaxApi.update).toHaveBeenCalledTimes(1));
    const [id, body] = vi.mocked(touristTaxApi.update).mock.calls[0];
    expect(id).toBe('rate-milano');
    expect(body).toMatchObject({
      city: 'Milano',
      ratePerPersonPerNight: 10,
      maxNights: 14,
      minimumAge: 18,
      effectiveFrom: '2026-01-01',
      sourceUrl: 'https://www.comune.milano.it/tariffe-2026',
      verificationLevel: 'Official',
    });
  });

  it('update_RateNoLongerExists_ShowsTranslatedNotFoundCode', async () => {
    vi.mocked(touristTaxApi.update).mockRejectedValue(
      problemError(404, { code: 'tourist_tax_rate_not_found', detail: 'Tariffa non trovata.' }),
    );
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getAllByTitle('Modifica')[0]);
    fireEvent.click(dialog().getByRole('button', { name: 'Aggiorna' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Questa tariffa non esiste più: ricarica l'elenco."),
    );
  });

  it('delete_ConfirmedDeletion_CallsDeleteWithTheRateId', async () => {
    vi.mocked(touristTaxApi.delete).mockResolvedValue(undefined);
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getAllByTitle('Elimina')[0]);
    fireEvent.click(dialog().getByRole('button', { name: 'Elimina' }));

    await waitFor(() => expect(touristTaxApi.delete).toHaveBeenCalledWith('rate-milano'));
    expect(toast.success).toHaveBeenCalledWith('Aliquota eliminata con successo');
  });

  it('delete_ApiError_ShowsProblemMessage', async () => {
    vi.mocked(touristTaxApi.delete).mockRejectedValue(
      problemError(404, { code: 'tourist_tax_rate_not_found' }),
    );
    renderPage();
    await screen.findByTestId('tax-rate-source-rate-milano');

    fireEvent.click(screen.getAllByTitle('Elimina')[0]);
    fireEvent.click(dialog().getByRole('button', { name: 'Elimina' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Questa tariffa non esiste più: ricarica l'elenco."),
    );
  });
});
