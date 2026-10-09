import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { PaymentCreatePage } from '../payment-create-page';

const queries = vi.hoisted(() => ({ useBookings: vi.fn(), useCreatePayment: vi.fn() }));
const support = vi.hoisted(() => ({ email: null as string | null }));

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/queries/use-bookings', () => ({ useBookings: queries.useBookings }));
vi.mock('@/queries/use-payments', () => ({ useCreatePayment: queries.useCreatePayment }));
vi.mock('@/config/support.config', () => ({ supportConfig: support }));

const GIULIA = { id: 'b1000000-1111-2222-3333-444444444444', guest: { firstName: 'Giulia', lastName: 'Bianchi' }, source: 'Direct' };
const AIRBNB = { id: 'b2000000-1111-2222-3333-444444444444', guest: { firstName: 'Marco', lastName: 'Rossi' }, source: 'Airbnb' };

const mutateAsync = vi.fn();

function mockBookings(state: Record<string, unknown>) {
  queries.useBookings.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn(), ...state });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/short-rent/payments/create']}>
      <Routes>
        <Route path="/app/short-rent/payments/create" element={<PaymentCreatePage />} />
        <Route path="/app/short-rent/payments" element={<p>Elenco dei pagamenti</p>} />
        <Route path="/app/short-rent/bookings/create" element={<p>Nuova prenotazione (pagina)</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Prenotazione *'), { target: { value: GIULIA.id } });
  fireEvent.change(screen.getByLabelText('Importo *'), { target: { value: '120.5' } });
  fireEvent.change(screen.getByLabelText('Metodo di pagamento *'), { target: { value: 'BankTransfer' } });
}

beforeEach(async () => {
  vi.clearAllMocks();
  support.email = null;
  await i18n.changeLanguage('it');
  mutateAsync.mockResolvedValue({ id: 'p1' });
  queries.useCreatePayment.mockReturnValue({ mutateAsync, isPending: false });
  mockBookings({ data: [GIULIA, AIRBNB] });
});

afterEach(cleanup);

describe('PaymentCreatePage (pilot of the UI primitives): the form', () => {
  it('PaymentCreatePage_Bookings_ShowsEveryFieldWithItsLabelAndTheOldIds', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Nuovo pagamento' })).toBeInTheDocument();
    const booking = screen.getByLabelText('Prenotazione *');
    expect(booking.tagName).toBe('SELECT');
    expect(booking).toHaveAttribute('id', 'bookingId');
    expect(screen.getByLabelText('Importo *')).toHaveAttribute('id', 'amount');
    expect(screen.getByLabelText('Importo *')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Valuta')).toHaveValue('EUR');
    expect(screen.getByLabelText('Valuta')).toHaveAttribute('id', 'currency');
    expect(screen.getByLabelText('Metodo di pagamento *').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Metodo di pagamento *')).toHaveAttribute('id', 'method');
    expect(screen.getByLabelText('Descrizione')).toHaveAttribute('id', 'description');
    expect(screen.getByText('(facoltativo)')).toBeInTheDocument();
  });

  it('PaymentCreatePage_BookingSelect_ListsEveryBookingOfTheHost', () => {
    renderPage();

    const options = within(screen.getByLabelText('Prenotazione *')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Seleziona una prenotazione',
      'Giulia Bianchi - b1000000',
      'Marco Rossi - b2000000',
    ]);
    expect(within(screen.getByLabelText('Metodo di pagamento *')).getAllByRole('option')).toHaveLength(6);
  });

  it('PaymentCreatePage_EmptySubmit_ShowsTheErrorsOnTheFieldsAndSendsNothing', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Crea pagamento' }));

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2));
    const booking = screen.getByLabelText('Prenotazione *');
    expect(booking).toHaveAttribute('aria-invalid', 'true');
    expect(booking).toHaveAccessibleDescription("La prenotazione e' obbligatoria");
    expect(screen.getByLabelText('Importo *')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Importo *')).toHaveAccessibleDescription(/L'importo deve essere maggiore di 0|Campo obbligatorio/);
    expect(screen.getByLabelText('Metodo di pagamento *')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Valuta')).not.toHaveAttribute('aria-invalid');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('PaymentCreatePage_ValidSubmit_CreatesThePaymentAndGoesBackToTheList', async () => {
    renderPage();
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Caparra' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crea pagamento' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: GIULIA.id, amount: 120.5, currency: 'EUR', method: 'BankTransfer', description: 'Caparra' }),
    );
    expect(await screen.findByText('Elenco dei pagamenti')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('PaymentCreatePage_Cancel_GoesBackToTheListWithoutSending', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));

    expect(screen.getByText('Elenco dei pagamenti')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('PaymentCreatePage_Saving_TheButtonIsBusyAndDoesNotSendTwice', async () => {
    queries.useCreatePayment.mockReturnValue({ mutateAsync, isPending: true });
    renderPage();
    fillValidForm();

    const button = screen.getByRole('button', { name: 'Creazione...' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).toHaveClass('animate-spin');
    fireEvent.click(button);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('PaymentCreatePage_OtaBooking_ShowsTheWithholdingHintAsAnInfoNotice', () => {
    renderPage();
    expect(screen.queryByTestId('fiscal-ota-withholding-hint')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Prenotazione *'), { target: { value: AIRBNB.id } });

    const hint = screen.getByTestId('fiscal-ota-withholding-hint');
    expect(hint).toHaveAttribute('role', 'status');
    expect(hint).toHaveTextContent(i18n.getFixedT('it')('fiscal.page.description'));

    fireEvent.change(screen.getByLabelText('Prenotazione *'), { target: { value: GIULIA.id } });
    expect(screen.queryByTestId('fiscal-ota-withholding-hint')).not.toBeInTheDocument();
  });
});

describe('PaymentCreatePage: the states of the list of bookings', () => {
  it('PaymentCreatePage_Loading_ShowsASkeletonAnnouncedAsLoadingBookingsAndNoForm', () => {
    mockBookings({ data: undefined, isLoading: true });
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Caricamento prenotazioni...');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crea pagamento' })).not.toBeInTheDocument();
  });

  it('PaymentCreatePage_LoadFailed_ShowsTheErrorWithRetryAndSupportNotAnEmptyForm', () => {
    const refetch = vi.fn();
    support.email = 'aiuto@casazen.test';
    mockBookings({ data: undefined, isError: true, error: new Error('boom'), refetch });
    renderPage();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Impossibile caricare le prenotazioni. Riprova.');
    expect(within(alert).getByRole('link', { name: 'aiuto@casazen.test' })).toHaveAttribute('href', 'mailto:aiuto@casazen.test');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('PaymentCreatePage_LoadFailedWithoutSupportEmail_InventsNoContact', () => {
    mockBookings({ data: undefined, isError: true, error: new Error('boom') });
    renderPage();

    expect(within(screen.getByRole('alert')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('PaymentCreatePage_NoBookings_ExplainsAndPointsToCreateOne', () => {
    mockBookings({ data: [] });
    renderPage();

    expect(screen.getByRole('heading', { level: 3, name: 'Non ci sono prenotazioni' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Nuova prenotazione' });
    expect(link).toHaveAttribute('href', '/app/short-rent/bookings/create');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(link);
    expect(screen.getByText('Nuova prenotazione (pagina)')).toBeInTheDocument();
  });

  it('PaymentCreatePage_English_UsesTheEnglishTexts', async () => {
    await i18n.changeLanguage('en');
    mockBookings({ data: [] });
    renderPage();

    expect(screen.getByRole('heading', { level: 3, name: 'There are no bookings' })).toBeInTheDocument();
  });
});
