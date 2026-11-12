import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { getInvoiceData, saveInvoiceData } from '@/api/invoice-data.api';
import { INVOICE_DATA_KEY } from '@/queries/use-invoice-data';
import type { BookingInvoiceData } from '@/types';
import { InvoiceDataSubstep } from '../invoice-data-substep';

vi.mock('@/api/invoice-data.api', () => ({ getInvoiceData: vi.fn(), saveInvoiceData: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const BOOKING = 'b0c1d2e3-0000-4000-8000-000000000002';
const FISCAL_CODE = 'RSSMRA80A01H501U';
const VAT_NUMBER = 'IT12345678903';

const invoiceData = (overrides: Partial<BookingInvoiceData> = {}): BookingInvoiceData => ({
  bookingId: BOOKING,
  invoiceRequested: false,
  ...overrides,
});

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function renderSubstep() {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // The sub-step sits inside the form of a wizard: it must never submit it.
  const view = render(
    <QueryClientProvider client={client}>
      <form onSubmit={onSubmit} data-testid="outer-form">
        <InvoiceDataSubstep bookingId={BOOKING} onDone={onDone} onCancel={onCancel} />
      </form>
    </QueryClientProvider>,
  );
  return { ...view, client, onDone, onCancel, onSubmit };
}

const field = (name: string) => screen.getByTestId(`invoice-data-${name}`) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const done = () => fireEvent.click(screen.getByTestId('invoice-data-substep-done'));

async function ready() {
  await screen.findByTestId('invoice-data-name');
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getInvoiceData).mockResolvedValue(invoiceData());
  vi.mocked(saveInvoiceData).mockImplementation(async (_bookingId, request) => ({ ...invoiceData(), ...request, source: 'Host' }));
});

afterEach(() => {
  cleanup();
});

describe('InvoiceDataSubstep - what the host sees', () => {
  it('substep_DataFromTheChannelManager_IsAlreadyInTheFieldsAndSaysWhereItCameFrom', async () => {
    vi.mocked(getInvoiceData).mockResolvedValue(
      invoiceData({ recipientKind: 'Company', name: 'Rossi S.r.l.', vatNumber: VAT_NUMBER, city: 'Roma', countryCode: 'IT', source: 'Octorate' }),
    );
    renderSubstep();
    await ready();

    expect(field('name').value).toBe('Rossi S.r.l.');
    expect(field('vatNumber').value).toBe(VAT_NUMBER);
    expect(field('city').value).toBe('Roma');
    expect(screen.getByTestId('invoice-data-kind-Company')).toBeChecked();
    expect(screen.getByTestId('invoice-data-substep-source')).toHaveTextContent('Dati arrivati dal tuo channel manager.');
  });

  it('substep_DataFromTheCheckIn_SaysTheGuestWroteIt', async () => {
    vi.mocked(getInvoiceData).mockResolvedValue(invoiceData({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE, source: 'CheckIn' }));
    renderSubstep();
    await ready();

    expect(field('fiscalCode').value).toBe(FISCAL_CODE);
    expect(screen.getByTestId('invoice-data-substep-source')).toHaveTextContent("Dati scritti dall'ospite al check-in.");
  });

  it('substep_NoDataYet_IsAPrivatePersonInItalyAndSaysNothingOfASource', async () => {
    renderSubstep();
    await ready();

    expect(screen.getByTestId('invoice-data-kind-Guest')).toBeChecked();
    expect(field('name').value).toBe('');
    expect(screen.queryByTestId('invoice-data-substep-source')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A chi intestare la fattura' })).toBeInTheDocument();
    expect(screen.getByTestId('invoice-data-substep-done')).toHaveTextContent('Fatto');
    expect(screen.getByTestId('invoice-data-substep-cancel')).toHaveTextContent('Annulla');
  });

  it('substep_AboutFiveThingsAtATime_TheRareOnesAreUnderMoreOptions', async () => {
    renderSubstep();
    await ready();

    const more = screen.getByTestId('invoice-data-more') as HTMLDetailsElement;
    expect(more.open).toBe(false);
    // Visible without opening anything: the kind, the name, the fiscal code and the address.
    for (const name of ['name', 'fiscalCode', 'addressStreet', 'addressCivic', 'postalCode', 'city', 'province']) {
      expect(more.contains(field(name))).toBe(false);
    }
    // Under «Altre opzioni»: the country, the code of the recipient, the PEC and (for a person) the VAT number.
    for (const name of ['countryCode', 'sdiRecipientCode', 'pec', 'vatNumber']) {
      expect(more.contains(screen.getByTestId(`invoice-data-${name}`))).toBe(true);
    }
  });

  it('substep_TheDifficultFields_SayWhyTheyAreAskedAndShowAnExample', async () => {
    renderSubstep();
    await ready();

    const fiscalCode = screen.getByText(/serve a intestare la fattura\. Per un'azienda basta la partita IVA/);
    expect(fiscalCode).toHaveTextContent('Esempio: RSSMRA80A01H501U');
    expect(screen.getByText(/serve a intestare la fattura a un'azienda o a un professionista/)).toHaveTextContent('Esempio: IT12345678903');
    expect(screen.getByText(/Perché lo chiediamo: è il codice con cui il destinatario/)).toHaveTextContent('Esempio: ABC1234');
    expect(screen.getByText(/Perché lo chiediamo: serve solo se il destinatario riceve le fatture sulla sua PEC/)).toHaveTextContent('Esempio: nome@pec.it');
    expect(field('fiscalCode')).toHaveAccessibleDescription(/Esempio: RSSMRA80A01H501U/);
  });

  it('substep_AnotherKind_ChangesTheWordsAndPutsTheVatNumberInFront', async () => {
    renderSubstep();
    await ready();
    expect(screen.getByLabelText('Nome e cognome')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-data-more').contains(field('vatNumber'))).toBe(true);

    fireEvent.click(screen.getByTestId('invoice-data-kind-Company'));

    expect(screen.getByLabelText('Ragione sociale')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-data-more').contains(field('vatNumber'))).toBe(false);
  });

  it('substep_TheDataCannotBeRead_SaysSoAndLeavesOnlyCancel', async () => {
    vi.mocked(getInvoiceData).mockRejectedValue(httpError(500));
    renderSubstep();

    expect(await screen.findByTestId('invoice-data-substep-load-failed')).toHaveTextContent('Non riesco a leggere i dati di fatturazione.');
    expect(screen.getByTestId('invoice-data-substep-done')).toBeDisabled();
    expect(screen.getByTestId('invoice-data-substep-cancel')).toBeEnabled();
  });
});

describe('InvoiceDataSubstep - Done and Cancel', () => {
  it('done_FiscalCodeMissing_ShowsTheErrorOnTheFieldAndSavesNothing', async () => {
    vi.mocked(getInvoiceData).mockResolvedValue(invoiceData({ name: 'Mario Rossi', source: 'CheckIn' }));
    const { onDone } = renderSubstep();
    await ready();

    done();

    expect(await screen.findByText('Scrivi il codice fiscale: serve per intestare la fattura.')).toBeInTheDocument();
    expect(field('fiscalCode')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(field('fiscalCode')).toHaveFocus());
    expect(saveInvoiceData).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    // What was typed stays.
    expect(field('name').value).toBe('Mario Rossi');
  });

  it('done_EveryFormatIsCheckedOnItsField_InSimpleWords', async () => {
    renderSubstep();
    await ready();
    type('fiscalCode', 'XYZ');
    type('vatNumber', '123');
    type('sdiRecipientCode', 'AB');
    type('pec', 'no');
    type('postalCode', '12');
    type('province', 'ROM');

    done();

    expect(await screen.findByText('Il codice fiscale non è valido: controlla i 16 caratteri (persona) o le 11 cifre (azienda).')).toBeInTheDocument();
    expect(screen.getByText('La partita IVA non è valida: controlla le 11 cifre.')).toBeInTheDocument();
    expect(screen.getByText('Il codice destinatario ha 7 lettere o cifre.')).toBeInTheDocument();
    expect(screen.getByText("L'indirizzo PEC non è valido: controlla la chiocciola e il dominio.")).toBeInTheDocument();
    expect(screen.getByText(/In Italia il CAP ha 5 cifre/)).toBeInTheDocument();
    expect(screen.getByText('La provincia si scrive con 2 lettere, per esempio RM.')).toBeInTheDocument();
    // The rare fields that are wrong open their options, so the error is not hidden.
    expect((screen.getByTestId('invoice-data-more') as HTMLDetailsElement).open).toBe(true);
    expect(saveInvoiceData).not.toHaveBeenCalled();
  });

  it('done_ErrorOfAField_GoesAwayWhenTheHostTypesInIt', async () => {
    renderSubstep();
    await ready();
    type('fiscalCode', 'XYZ');
    done();
    await screen.findByText(/Il codice fiscale non è valido/);

    type('fiscalCode', FISCAL_CODE);

    expect(screen.queryByText(/Il codice fiscale non è valido/)).not.toBeInTheDocument();
    expect(field('fiscalCode')).not.toHaveAttribute('aria-invalid');
  });

  it('done_ValidDataTypedByTheHost_IsSavedNormalizedAndTheSubstepCloses', async () => {
    const { onDone, onCancel } = renderSubstep();
    await ready();
    type('name', '  Mario   Rossi ');
    type('fiscalCode', ' rssmra80a01 h501u ');
    type('addressStreet', 'Via Roma');
    type('postalCode', '001 00');
    type('city', 'Roma');
    type('province', 'rm');

    done();

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(saveInvoiceData).toHaveBeenCalledTimes(1);
    expect(saveInvoiceData).toHaveBeenCalledWith(BOOKING, {
      recipientKind: 'Guest',
      name: 'Mario Rossi',
      fiscalCode: FISCAL_CODE,
      vatNumber: '',
      addressStreet: 'Via Roma',
      addressCivic: '',
      postalCode: '00100',
      city: 'Roma',
      province: 'RM',
      countryCode: 'IT',
      sdiRecipientCode: '',
      pec: '',
    });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('done_CompanyWithAVatNumber_IsSavedAsACompany', async () => {
    const { onDone } = renderSubstep();
    await ready();
    fireEvent.click(screen.getByTestId('invoice-data-kind-Company'));
    type('name', 'Rossi S.r.l.');
    type('vatNumber', '12345678903');

    done();

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(saveInvoiceData).toHaveBeenCalledWith(BOOKING, expect.objectContaining({ recipientKind: 'Company', name: 'Rossi S.r.l.', vatNumber: VAT_NUMBER }));
  });

  it('done_NothingChanged_ClosesWithoutSavingSoALookDoesNotMakeTheHostTheAuthor', async () => {
    vi.mocked(getInvoiceData).mockResolvedValue(invoiceData({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE, countryCode: 'IT', source: 'Octorate' }));
    const { onDone } = renderSubstep();
    await ready();

    done();

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(saveInvoiceData).not.toHaveBeenCalled();
  });

  it('done_ServerRefusesFields_ShowsThemOnTheirFieldsKeepsWhatWasTypedAndStaysOpen', async () => {
    vi.mocked(saveInvoiceData).mockRejectedValue(
      httpError(422, {
        code: 'invoice_data_fiscal_code_invalid',
        field: 'fiscalCode',
        errors: [
          { field: 'fiscalCode', code: 'invoice_data_fiscal_code_invalid' },
          { field: 'pec', code: 'invoice_data_pec_invalid' },
        ],
      }),
    );
    const { onDone } = renderSubstep();
    await ready();
    type('name', 'Mario Rossi');
    type('fiscalCode', FISCAL_CODE);
    type('pec', 'mario@pec.it');

    done();

    expect(await screen.findByText(/Il codice fiscale non è valido/)).toBeInTheDocument();
    expect(screen.getByText(/L'indirizzo PEC non è valido/)).toBeInTheDocument();
    expect(field('fiscalCode')).toHaveAttribute('aria-invalid', 'true');
    expect(field('pec')).toHaveAttribute('aria-invalid', 'true');
    expect(field('name').value).toBe('Mario Rossi');
    expect(field('pec').value).toBe('mario@pec.it');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('done_AnyOtherFailure_SaysSoInThePanelAndKeepsWhatWasTyped', async () => {
    vi.mocked(saveInvoiceData).mockRejectedValue(httpError(500, { status: 500 }));
    const { onDone } = renderSubstep();
    await ready();
    type('name', 'Mario Rossi');
    type('fiscalCode', FISCAL_CODE);

    done();

    expect(await screen.findByTestId('invoice-data-substep-problem')).toHaveTextContent('Non sono riuscito a salvare i dati. Riprova.');
    expect(field('name').value).toBe('Mario Rossi');
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('invoice-data-substep-done')).toBeEnabled();
  });

  it('cancel_AfterTyping_GivesUpWithoutSavingAnything', async () => {
    const { onCancel, onDone } = renderSubstep();
    await ready();
    type('name', 'Mario Rossi');
    type('fiscalCode', FISCAL_CODE);

    fireEvent.click(screen.getByTestId('invoice-data-substep-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(saveInvoiceData).not.toHaveBeenCalled();
  });

  it('substep_InsideTheFormOfAWizard_NeverSubmitsIt', async () => {
    const { onSubmit } = renderSubstep();
    await ready();
    const panel = screen.getByTestId('invoice-data-substep');

    expect(panel.querySelector('form')).toBeNull();
    for (const button of within(panel).getAllByRole('button')) expect((button as HTMLButtonElement).type).toBe('button');

    done();
    await screen.findByText(/Scrivi il codice fiscale/);
    fireEvent.click(screen.getByTestId('invoice-data-substep-cancel'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('done_EnterInAField_IsDoneAndNeverPressesTheSubmitOfTheFormThatHoldsThePanel', async () => {
    const { onDone, onSubmit } = renderSubstep();
    await ready();
    type('name', 'Mario Rossi');
    type('fiscalCode', FISCAL_CODE);

    // `fireEvent` answers false when the default action of the key was cancelled: no implicit submit of the wizard.
    expect(fireEvent.keyDown(field('name'), { key: 'Enter' })).toBe(false);

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(saveInvoiceData).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('done_EnterInAFieldOfAnInvalidForm_ShowsTheErrorsAndSubmitsNothing', async () => {
    const { onDone, onSubmit } = renderSubstep();
    await ready();
    type('name', 'Mario Rossi');

    fireEvent.keyDown(field('name'), { key: 'Enter' });

    expect(await screen.findByText('Scrivi il codice fiscale: serve per intestare la fattura.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    // Any other key is left alone.
    expect(fireEvent.keyDown(field('name'), { key: 'a' })).toBe(true);
  });

  it('substep_ReadComesInWhileTheHostTypes_KeepsWhatWasTypedAndUpdatesTheRest', async () => {
    vi.mocked(getInvoiceData).mockResolvedValue(invoiceData({ name: 'Mario Rossi', city: 'Roma', source: 'Octorate' }));
    const { client } = renderSubstep();
    await ready();
    type('name', 'Mario Bianchi');

    act(() => {
      client.setQueryData([INVOICE_DATA_KEY, BOOKING], invoiceData({ name: 'Mario Rossi', city: 'Milano', source: 'CheckIn' }));
    });

    await waitFor(() => expect(field('city').value).toBe('Milano'));
    expect(field('name').value).toBe('Mario Bianchi');
  });
});
