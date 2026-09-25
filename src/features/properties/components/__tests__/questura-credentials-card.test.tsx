import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { questuraCredentialsApi } from '@/api/questura-credentials.api';
import { QuesturaCredentialsCard } from '../questura-credentials-card';

vi.mock('@/api/questura-credentials.api', () => ({
  questuraCredentialsApi: { getStatus: vi.fn(), set: vi.fn(), remove: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PROPERTY_ID = 'pppppppp-pppp-pppp-pppp-pppppppppppp';

function renderCard(canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(QuesturaCredentialsCard, { propertyId: PROPERTY_ID, canEdit })),
  );
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('QuesturaCredentialsCard (CO-14)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('status_NotConfigured_ShowsNotConfiguredAndEmptyForm', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockResolvedValue({ configured: false, configuredAt: null });

    renderCard();

    expect(await screen.findByText('Non configurate')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome utente')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Chiave web service (WSKey)')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Salva credenziali' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rimuovi credenziali' })).not.toBeInTheDocument();
  });

  it('status_Configured_ShowsOnlyTheDateNeverAValue', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockResolvedValue({
      configured: true,
      configuredAt: '2026-09-20T10:30:00Z',
    });

    renderCard();

    expect(await screen.findByText(/^Configurate il 20\/09\/2026/)).toBeInTheDocument();
    // Write-only: the form stays empty, there is nothing to reveal.
    expect(screen.getByLabelText('Nome utente')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Chiave web service (WSKey)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Sostituisci credenziali' })).toBeInTheDocument();
  });

  it('submit_MissingFields_ShowsErrorsAndDoesNotCallApi', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockResolvedValue({ configured: false, configuredAt: null });
    renderCard();
    await screen.findByText('Non configurate');

    fill('Nome utente', '   ');
    fireEvent.click(screen.getByRole('button', { name: 'Salva credenziali' }));

    expect(await screen.findByText('Inserisci il nome utente di Alloggiati Web.')).toBeInTheDocument();
    expect(screen.getByText('Inserisci la password di Alloggiati Web.')).toBeInTheDocument();
    expect(screen.getByText('Inserisci la chiave del web service (WSKey).')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome utente')).toHaveAttribute('aria-invalid', 'true');
    expect(questuraCredentialsApi.set).not.toHaveBeenCalled();
  });

  it('submit_TooLongPassword_ShowsErrorAndDoesNotCallApi', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockResolvedValue({ configured: false, configuredAt: null });
    renderCard();
    await screen.findByText('Non configurate');

    fill('Nome utente', 'RM000123');
    fill('Password', 'x'.repeat(201));
    fill('Chiave web service (WSKey)', 'WSKEY-1');
    fireEvent.click(screen.getByRole('button', { name: 'Salva credenziali' }));

    expect(await screen.findByText('La password può avere al massimo 200 caratteri.')).toBeInTheDocument();
    expect(questuraCredentialsApi.set).not.toHaveBeenCalled();
  });

  it('submit_ValidValues_SendsThemClearsTheFormAndShowsConfiguredDate', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockResolvedValue({ configured: false, configuredAt: null });
    vi.mocked(questuraCredentialsApi.set).mockResolvedValue({ configured: true, configuredAt: '2026-09-24T08:15:00Z' });
    renderCard();
    await screen.findByText('Non configurate');

    fill('Nome utente', 'RM000123');
    fill('Password', ' secret pass ');
    fill('Chiave web service (WSKey)', 'WSKEY-ABC');
    fireEvent.click(screen.getByRole('button', { name: 'Salva credenziali' }));

    await waitFor(() =>
      expect(questuraCredentialsApi.set).toHaveBeenCalledWith(PROPERTY_ID, {
        username: 'RM000123',
        password: ' secret pass ',
        wsKey: 'WSKEY-ABC',
      }),
    );
    expect(await screen.findByText(/^Configurate il 24\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nome utente')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Chiave web service (WSKey)')).toHaveValue('');
    expect(toast.success).toHaveBeenCalledWith('Credenziali Alloggiati Web salvate.');
  });

  it('submit_ApiRejects_KeepsTheValuesAndShowsTheProblemMessage', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockResolvedValue({ configured: false, configuredAt: null });
    vi.mocked(questuraCredentialsApi.set).mockRejectedValue(new Error('network'));
    renderCard();
    await screen.findByText('Non configurate');

    fill('Nome utente', 'RM000123');
    fill('Password', 'secret');
    fill('Chiave web service (WSKey)', 'WSKEY-ABC');
    fireEvent.click(screen.getByRole('button', { name: 'Salva credenziali' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Impossibile salvare le credenziali.'));
    expect(screen.getByLabelText('Nome utente')).toHaveValue('RM000123');
    expect(screen.getByText('Non configurate')).toBeInTheDocument();
  });

  it('remove_Confirmed_CallsApiAndShowsNotConfigured', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockResolvedValue({
      configured: true,
      configuredAt: '2026-09-20T10:30:00Z',
    });
    vi.mocked(questuraCredentialsApi.remove).mockResolvedValue(undefined);
    renderCard();
    await screen.findByText(/^Configurate il/);

    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi credenziali' }));
    expect(questuraCredentialsApi.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma rimozione' }));

    await waitFor(() => expect(questuraCredentialsApi.remove).toHaveBeenCalledWith(PROPERTY_ID));
    expect(await screen.findByText('Non configurate')).toBeInTheDocument();
  });

  it('status_LoadFails_ShowsErrorNotNotConfigured', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockRejectedValue(new Error('network'));

    renderCard();

    expect(await screen.findByTestId('questura-credentials-error')).toBeInTheDocument();
    expect(screen.queryByText('Non configurate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('questura-credentials-form')).not.toBeInTheDocument();
  });

  it('render_WithoutWritePermission_ShowsStatusWithoutForm', async () => {
    vi.mocked(questuraCredentialsApi.getStatus).mockResolvedValue({ configured: false, configuredAt: null });

    renderCard(false);

    expect(await screen.findByText('Non configurate')).toBeInTheDocument();
    expect(screen.queryByTestId('questura-credentials-form')).not.toBeInTheDocument();
  });
});
