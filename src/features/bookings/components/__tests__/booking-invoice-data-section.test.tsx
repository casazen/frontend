import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { getInvoiceData, saveInvoiceData } from '@/api/invoice-data.api';
import type { BookingInvoiceData } from '@/types';
import { BookingInvoiceDataSection } from '../booking-invoice-data-section';

vi.mock('@/api/invoice-data.api', () => ({ getInvoiceData: vi.fn(), saveInvoiceData: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** The permissions of the person, by `<context>:<permission>`; the section reads `payment.read` and `payment.write` of the short-rent context. */
let granted = new Set<string>();
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => granted.has(`${context}:${permission}`) }),
}));

const BOOKING = 'b0c1d2e3-0000-4000-8000-000000000002';
const FISCAL_CODE = 'RSSMRA80A01H501U';
const VAT_NUMBER = 'IT12345678903';
const READ = 'short-rent:payment.read';
const WRITE = 'short-rent:payment.write';

let stored: BookingInvoiceData;
const invoiceData = (overrides: Partial<BookingInvoiceData> = {}): BookingInvoiceData => ({ bookingId: BOOKING, invoiceRequested: false, ...overrides });

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BookingInvoiceDataSection bookingId={BOOKING} />
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
  granted = new Set([READ, WRITE]);
  stored = invoiceData();
  vi.mocked(getInvoiceData).mockImplementation(async () => stored);
  vi.mocked(saveInvoiceData).mockImplementation(async (_bookingId, request) => {
    stored = { ...stored, ...request, source: 'Host' };
    return stored;
  });
});

afterEach(() => {
  cleanup();
});

describe('BookingInvoiceDataSection - who may see and change it (permission)', () => {
  it('section_WithoutPaymentRead_IsNotThereAndTheDataIsNeverAsked', async () => {
    granted = new Set(['short-rent:booking.read']);
    renderSection();

    // Nothing is drawn: the data is what an invoice is made of, never shown to a role that does not see the money.
    expect(screen.queryByTestId('booking-invoice-data')).not.toBeInTheDocument();
    await Promise.resolve();
    expect(getInvoiceData).not.toHaveBeenCalled();
  });

  it('section_WithoutPaymentWrite_ShowsTheDataAndNoWayToChangeIt', async () => {
    granted = new Set([READ]);
    stored = invoiceData({ recipientKind: 'Guest', name: 'Mario Rossi', fiscalCode: FISCAL_CODE, source: 'CheckIn' });
    renderSection();

    expect(await screen.findByTestId('booking-invoice-kind')).toHaveTextContent('Fattura per una persona.');
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
    expect(screen.getByTestId('booking-invoice-readonly')).toHaveTextContent('Solo chi gestisce i pagamenti può modificarli.');
    expect(screen.queryByTestId('booking-invoice-open')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('section_WithPaymentWrite_OffersTheButtonThatOpensTheSubstep', async () => {
    stored = invoiceData({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE, source: 'Host' });
    renderSection();

    const button = await screen.findByTestId('booking-invoice-open');
    expect(button).toHaveTextContent('Controlla o modifica');
    expect(screen.queryByTestId('booking-invoice-readonly')).not.toBeInTheDocument();
  });
});

describe('BookingInvoiceDataSection - what it says', () => {
  it('section_DataOfACompany_SaysWhoToInvoiceInWordsWithItsFields', async () => {
    stored = invoiceData({
      recipientKind: 'Company',
      name: 'Rossi S.r.l.',
      vatNumber: VAT_NUMBER,
      addressStreet: 'Via Roma',
      addressCivic: '1',
      postalCode: '00100',
      city: 'Roma',
      province: 'RM',
      countryCode: 'IT',
      sdiRecipientCode: 'ABC1234',
      pec: 'rossi@pec.it',
      source: 'Host',
    });
    renderSection();

    await screen.findByTestId('booking-invoice-kind');
    const section = within(screen.getByTestId('booking-invoice-data'));
    expect(section.getByRole('heading', { name: 'Dati di fatturazione' })).toBeInTheDocument();
    expect(section.getByTestId('booking-invoice-kind')).toHaveTextContent("Fattura per un'azienda.");
    expect(section.getByText('Ragione sociale')).toBeInTheDocument();
    expect(section.getByText('Rossi S.r.l.')).toBeInTheDocument();
    expect(section.getByText('Partita IVA')).toBeInTheDocument();
    expect(section.getByText(VAT_NUMBER)).toBeInTheDocument();
    expect(section.getByText('Via Roma 1, 00100 Roma (RM)')).toBeInTheDocument();
    expect(section.getByText('ABC1234')).toBeInTheDocument();
    expect(section.getByText('rossi@pec.it')).toBeInTheDocument();
    expect(section.queryByTestId('booking-invoice-missing')).not.toBeInTheDocument();
  });

  it('section_AddressAbroad_NamesTheCountryInTheLanguageOfThePage', async () => {
    stored = invoiceData({ name: 'Hans Meier', addressStreet: 'Hauptstrasse', addressCivic: '5', postalCode: '10115', city: 'Berlin', countryCode: 'DE', source: 'CheckIn' });
    renderSection();

    expect(await screen.findByText('Hauptstrasse 5, 10115 Berlin, Germania')).toBeInTheDocument();
  });

  it.each([
    ['Octorate', 'Dati arrivati dal tuo channel manager.'],
    ['CheckIn', "Dati scritti dall'ospite al check-in."],
    ['Host', 'Dati modificati da te.'],
  ] as const)('section_DataFrom%s_SaysWhereItCameFromInWords', async (source, words) => {
    stored = invoiceData({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE, source });
    renderSection();

    const line = await screen.findByTestId('booking-invoice-source');
    expect(line).toHaveTextContent(words);
    expect(line).toHaveAttribute('data-source', source);
  });

  it('section_TheGuestAskedForTheInvoiceButWroteNothing_SaysSoAndOffersToAddTheData', async () => {
    stored = invoiceData({ invoiceRequested: true, source: 'CheckIn' });
    renderSection();

    expect(await screen.findByTestId('booking-invoice-requested')).toHaveTextContent("L'ospite ha chiesto la fattura al check-in.");
    expect(screen.getByTestId('booking-invoice-empty')).toHaveTextContent('non ha scritto i suoi dati');
    expect(screen.getByTestId('booking-invoice-open')).toHaveTextContent('Aggiungi i dati');
  });

  it('section_NoDataAtAll_SaysSoWithoutASource', async () => {
    renderSection();

    expect(await screen.findByTestId('booking-invoice-empty')).toHaveTextContent('Nessun dato di fatturazione');
    expect(screen.queryByTestId('booking-invoice-requested')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-invoice-source')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-invoice-open')).toHaveTextContent('Aggiungi i dati');
  });

  it('section_DataThatDoesNotIdentifyTheRecipient_SaysWhatIsMissing', async () => {
    stored = invoiceData({ name: 'Mario Rossi', source: 'Octorate' });
    renderSection();

    expect(await screen.findByTestId('booking-invoice-missing')).toHaveTextContent('Manca il codice fiscale');
  });

  it('section_TheDataCannotBeRead_SaysSoAndCanTryAgain', async () => {
    vi.mocked(getInvoiceData).mockRejectedValueOnce(new Error('network'));
    renderSection();

    expect(await screen.findByTestId('booking-invoice-data-failed')).toHaveTextContent('Non riesco a leggere i dati di fatturazione.');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('booking-invoice-empty')).toBeInTheDocument();
  });
});

describe('BookingInvoiceDataSection - the sub-step', () => {
  it('section_OpenAndCancel_ReturnsToTheSectionAndTheFocusToTheButton', async () => {
    stored = invoiceData({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE, source: 'Host' });
    renderSection();
    fireEvent.click(await screen.findByTestId('booking-invoice-open'));

    expect(await screen.findByTestId('invoice-data-substep')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-invoice-kind')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('invoice-data-substep-cancel'));

    expect(await screen.findByTestId('booking-invoice-kind')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-data-substep')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('booking-invoice-open')).toHaveFocus());
    expect(saveInvoiceData).not.toHaveBeenCalled();
  });

  it('section_DoneAfterAChange_SavesAsTheHostAndTheSectionShowsTheNewData', async () => {
    stored = invoiceData({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE, source: 'Octorate' });
    renderSection();
    fireEvent.click(await screen.findByTestId('booking-invoice-open'));
    await screen.findByTestId('invoice-data-substep');
    fireEvent.change(await screen.findByTestId('invoice-data-city'), { target: { value: 'Roma' } });

    fireEvent.click(screen.getByTestId('invoice-data-substep-done'));

    await waitFor(() => expect(screen.queryByTestId('invoice-data-substep')).not.toBeInTheDocument());
    expect(saveInvoiceData).toHaveBeenCalledWith(BOOKING, expect.objectContaining({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE, city: 'Roma' }));
    const source = await screen.findByTestId('booking-invoice-source');
    expect(source).toHaveTextContent('Dati modificati da te.');
    expect(screen.getByText('Roma')).toBeInTheDocument();
  });
});
