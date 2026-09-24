import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { CheckInPage } from '../checkin-page';
import { publicCheckinApi } from '@/api/checkin.api';
import type { PublicCheckInContextDto } from '@/types/public-checkin.types';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: { getContext: vi.fn(), submit: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Checkbox measures itself with ResizeObserver, which jsdom does not provide.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const TOKEN = 'tok-123';

const openContext: PublicCheckInContextDto = {
  completed: false,
  status: 'InCompilazione',
  sessionId: '11111111-1111-1111-1111-111111111111',
  propertyName: 'Villa Demo',
  checkInDate: '2026-10-10T00:00:00Z',
  checkOutDate: '2026-10-12T00:00:00Z',
  guestPrefill: {
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario@example.com',
    dateOfBirth: null,
    nationality: '',
    gender: null,
    documentNumberMasked: null,
    documentIssuingCountry: '',
    placeOfBirth: '',
  },
};

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`/checkin/${TOKEN}`] },
        createElement(Routes, null, createElement(Route, { path: '/checkin/:token', element: createElement(CheckInPage) })),
      ),
    ),
  );
}

function change(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function fillPersonalStep(gender = 'Female') {
  change(/^Nome/, 'Giulia');
  change(/^Cognome/, 'Bianchi');
  change(/^Sesso/, gender);
  change(/^Data di nascita/, '1992-03-08');
  change(/^Luogo di nascita/, 'Firenze');
  change(/^Nazionalita/, 'Italiana');
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByLabelText(/^Tipo documento/);
}

async function fillDocumentStep() {
  change(/^Tipo documento/, 'IdentityCard');
  change(/^Numero documento/, 'CA12345AB');
  change(/^Paese di rilascio/, 'Italia');
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByTestId('checkin-gdpr-consent');
}

async function submitCompleteForm() {
  await screen.findByTestId('checkin-page');
  await fillPersonalStep();
  await fillDocumentStep();
  fireEvent.click(within(screen.getByTestId('checkin-gdpr-consent')).getByRole('checkbox'));
  fireEvent.click(screen.getByTestId('checkin-submit'));
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(publicCheckinApi.getContext).mockResolvedValue(openContext);
});

describe('CheckInPage', () => {
  it('genderSelect_openSession_offersOnlyAlloggiatiValues', async () => {
    renderPage();

    const select = (await screen.findByLabelText(/^Sesso/)) as HTMLSelectElement;

    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'Male', 'Female']);
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['Seleziona', 'Maschio', 'Femmina']);
  });

  it('next_missingRequiredFields_showsErrorOnEachFieldAndStaysOnStep', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
      ...openContext,
      guestPrefill: { ...openContext.guestPrefill!, firstName: '', lastName: '' },
    });
    renderPage();
    await screen.findByTestId('checkin-page');

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

    expect(await screen.findByText('Seleziona il sesso')).toBeInTheDocument();
    expect(screen.getByText('Nome obbligatorio')).toBeInTheDocument();
    expect(screen.getByText('Data di nascita obbligatoria')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Sesso/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Sesso/)).toHaveAttribute('aria-describedby', 'gender-error');
    expect(screen.queryByLabelText(/^Tipo documento/)).not.toBeInTheDocument();
  });

  it('submit_validForm_sendsSelectedGender', async () => {
    vi.mocked(publicCheckinApi.submit).mockResolvedValue({ sessionId: openContext.sessionId!, message: 'ok' });
    renderPage();

    await submitCompleteForm();

    await waitFor(() => expect(publicCheckinApi.submit).toHaveBeenCalledTimes(1));
    const [token, payload] = vi.mocked(publicCheckinApi.submit).mock.calls[0];
    expect(token).toBe(TOKEN);
    expect(payload.gender).toBe('Female');
    expect(await screen.findByText('Check-in completato!')).toBeInTheDocument();
  });

  it('submit_serverValidationProblem_showsServerErrorsOnTheirFields', async () => {
    vi.mocked(publicCheckinApi.submit).mockRejectedValue(
      httpError(400, {
        code: 'validation_error',
        errors: {
          Gender: ['Seleziona maschio o femmina: sono gli unici valori accettati da Alloggiati Web.'],
          DocumentNumber: ['Campo obbligatorio.'],
        },
      }),
    );
    renderPage();

    await submitCompleteForm();

    // Back to the first step with an error: the gender field shows the server message.
    expect(
      await screen.findByText('Seleziona maschio o femmina: sono gli unici valori accettati da Alloggiati Web.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Sesso/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('checkin-submit-error')).toHaveTextContent('correggi i campi evidenziati');

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
    await screen.findByLabelText(/^Numero documento/);
    expect(screen.getByText('Campo obbligatorio.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Numero documento/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('submit_errorWithoutFieldErrors_showsProblemMessageInline', async () => {
    vi.mocked(publicCheckinApi.submit).mockRejectedValue(
      httpError(400, { code: 'bad_request', detail: 'Richiesta non valida per questo soggiorno.' }),
    );
    renderPage();

    await submitCompleteForm();

    expect(await screen.findByTestId('checkin-submit-error')).toHaveTextContent('Richiesta non valida per questo soggiorno.');
  });

  it('submit_alreadySubmittedConflict_showsAlreadyCompletedState', async () => {
    vi.mocked(publicCheckinApi.submit).mockRejectedValue(
      httpError(409, { code: 'checkin_already_submitted', detail: 'Il check-in è già stato completato.' }),
    );
    renderPage();
    await screen.findByTestId('checkin-page');
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'AlloggiatiInviato' });

    await fillPersonalStep();
    await fillDocumentStep();
    fireEvent.click(within(screen.getByTestId('checkin-gdpr-consent')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('checkin-submit'));

    expect(await screen.findByText('Check-in già completato')).toBeInTheDocument();
  });

  it('completedContext_showsAlreadyCompletedWithoutFormOrGuestData', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'Completo' });

    renderPage();

    expect(await screen.findByText('Check-in già completato')).toBeInTheDocument();
    expect(screen.getByText(/non vengono più mostrati/)).toBeInTheDocument();
    expect(screen.queryByTestId('guest-data-form')).not.toBeInTheDocument();
    expect(screen.queryByText('Link non valido')).not.toBeInTheDocument();
  });

  it('prefill_maskedDocumentNumber_isShownAsHintAndNeverPrefilled', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({
      ...openContext,
      guestPrefill: {
        ...openContext.guestPrefill!,
        gender: 'Male',
        dateOfBirth: '1985-03-10T00:00:00Z',
        placeOfBirth: 'Milano',
        nationality: 'Italiana',
        documentNumberMasked: '*****456',
        documentIssuingCountry: 'Italia',
      },
    });
    renderPage();
    await screen.findByTestId('checkin-page');
    await waitFor(() => expect(screen.getByLabelText(/^Sesso/)).toHaveValue('Male'));

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

    expect(await screen.findByLabelText(/^Numero documento/)).toHaveValue('');
    expect(screen.getByTestId('checkin-document-on-file')).toHaveTextContent('*****456');
  });
});
