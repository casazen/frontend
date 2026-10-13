import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { OtaStayForm } from '../ota-stay-form';
import type { Booking } from '@/types';

vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { createOtaStay: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const BLOCK_ID = 'block-1';

const stay: Booking = {
  id: 'stay-1',
  propertyId: 'property-1',
  userId: '',
  checkInDate: '2027-10-02T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  numberOfGuests: 1,
  totalPrice: 0,
  currency: 'EUR',
  status: 'Confirmed',
  source: 'Airbnb',
  icalFeedId: 'feed-1',
  channelLabel: null,
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '', country: '' },
  createdAt: '2027-09-01T10:00:00Z',
  updatedAt: '2027-09-01T10:00:00Z',
};

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

function renderForm(channel: string | null, onCreated = vi.fn(), onCancel = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(OtaStayForm, { blockId: BLOCK_ID, channel, onCreated, onCancel }),
    ),
  );
  return { onCreated, onCancel };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Crea soggiorno' }));

describe('OtaStayForm (CO-21)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('submit_EmptyNameAndEmail_ShowsFieldErrorsWithoutCallingApi', async () => {
    renderForm('Airbnb');

    submit();

    expect(await screen.findByText("Inserisci il nome dell'ospite.")).toBeInTheDocument();
    expect(screen.getByText("Inserisci il cognome dell'ospite.")).toBeInTheDocument();
    expect(screen.getByText("Inserisci l'email dell'ospite.")).toBeInTheDocument();
    expect(screen.getByLabelText('Nome ospite')).toHaveAttribute('aria-invalid', 'true');
    expect(bookingsApi.createOtaStay).not.toHaveBeenCalled();
  });

  it('submit_InvalidEmailGuestsAndAmount_ShowsTheirErrors', async () => {
    renderForm('Airbnb');
    type('Nome ospite', 'Mario');
    type('Cognome ospite', 'Rossi');
    type('Email ospite', 'mario.example.com');
    type('Numero di ospiti (facoltativo)', '0');
    type('Importo in € (facoltativo)', '12,345');

    submit();

    expect(await screen.findByText('Inserisci un indirizzo email valido.')).toBeInTheDocument();
    expect(screen.getByText('Il numero di ospiti deve essere un numero intero da 1 a 100.')).toBeInTheDocument();
    expect(screen.getByText('Inserisci un importo valido, ad esempio 250 o 250,50.')).toBeInTheDocument();
    expect(bookingsApi.createOtaStay).not.toHaveBeenCalled();
  });

  it('submit_AirbnbFeed_SendsOnlyGuestAndNoInventedAmountOrSource', async () => {
    vi.mocked(bookingsApi.createOtaStay).mockResolvedValue(stay);
    const { onCreated } = renderForm('Airbnb');

    // The source comes from the feed: no channel to choose.
    expect(screen.queryByLabelText('Canale della prenotazione')).not.toBeInTheDocument();
    type('Nome ospite', '  Mario ');
    type('Cognome ospite', 'Rossi');
    type('Email ospite', ' mario@example.com ');
    submit();

    await waitFor(() =>
      expect(bookingsApi.createOtaStay).toHaveBeenCalledWith(BLOCK_ID, {
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'mario@example.com',
      }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(stay));
  });

  it('submit_OtherFeed_RequiresTheChannelThenSendsItWithGuestsAndAmount', async () => {
    vi.mocked(bookingsApi.createOtaStay).mockResolvedValue({ ...stay, source: 'Expedia' });
    renderForm('Other');
    type('Nome ospite', 'Anna');
    type('Cognome ospite', 'Verdi');
    type('Email ospite', 'anna@example.com');
    type('Numero di ospiti (facoltativo)', '3');
    type('Importo in € (facoltativo)', '250,50');

    submit();
    expect(await screen.findByText('Scegli il canale della prenotazione.')).toBeInTheDocument();
    expect(bookingsApi.createOtaStay).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Canale della prenotazione'), { target: { value: 'Expedia' } });
    submit();

    await waitFor(() =>
      expect(bookingsApi.createOtaStay).toHaveBeenCalledWith(BLOCK_ID, {
        firstName: 'Anna',
        lastName: 'Verdi',
        email: 'anna@example.com',
        numberOfGuests: 3,
        totalPrice: 250.5,
        source: 'Expedia',
      }),
    );
  });

  it('submit_BlockAlreadyConverted_ShowsTranslatedConflictAndKeepsTheForm', async () => {
    vi.mocked(bookingsApi.createOtaStay).mockRejectedValue(
      problemError(409, { code: 'ota_stay_block_already_converted', detail: 'server text' }),
    );
    const { onCreated } = renderForm('BookingCom');
    type('Nome ospite', 'Mario');
    type('Cognome ospite', 'Rossi');
    type('Email ospite', 'mario@example.com');

    submit();

    expect(await screen.findByTestId('ota-stay-error')).toHaveTextContent('Da questo blocco è già stato creato un soggiorno.');
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nome ospite')).toHaveValue('Mario');

    // A new attempt hides the error of the previous one.
    type('Email ospite', 'mario.rossi@example.com');
    expect(screen.queryByTestId('ota-stay-error')).not.toBeInTheDocument();
  });

  it('cancel_Click_CallsOnCancel', () => {
    const { onCancel } = renderForm('Airbnb');

    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
