import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlloggiatiGuestSummary } from '../components/alloggiati-guest-summary';
import { alloggiatiApi } from '@/api/alloggiati.api';
import type { AlloggiatiGuestSummaryDto } from '@/types/alloggiati.types';

vi.mock('@/api/alloggiati.api', () => ({
  alloggiatiApi: {
    getSummary: vi.fn(),
    getStatus: vi.fn(),
    getGuestSummary: vi.fn(),
    markSentManually: vi.fn(),
    replaceStayGuests: vi.fn(),
    searchCodes: vi.fn(),
    getDocumentNumbers: vi.fn(),
  },
}));

// Radix Dialog measures itself with ResizeObserver, which jsdom does not provide.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const noCodes = {
  type: null,
  birthComune: null,
  birthCountry: null,
  citizenship: null,
  documentType: null,
  documentTypeDescription: null,
  documentIssuePlace: null,
};

const summary: AlloggiatiGuestSummaryDto = {
  bookingId: BOOKING_ID,
  status: 'DaInviareManualmente',
  arrivalDate: '2026-10-10T00:00:00Z',
  stayDays: 3,
  stayExceedsMaxDays: false,
  declaredGuests: 3,
  dataComplete: false,
  exportReady: false,
  missingCodeTables: ['Comuni', 'Stati', 'Documenti', 'TipiAlloggiato'],
  guests: [
    {
      stayGuestId: 'g1',
      position: 0,
      type: 'HeadOfFamily',
      isMinor: false,
      arrivalDate: '2026-10-10T00:00:00Z',
      stayDays: 3,
      lastName: 'Rossi',
      firstName: 'Mario',
      gender: 'Male',
      dateOfBirth: '1980-04-02T00:00:00Z',
      bornInItaly: true,
      birthComune: 'Milano',
      birthProvince: 'MI',
      birthCountry: '',
      citizenship: 'Italia',
      requiresDocument: true,
      documentType: 'IdentityCard',
      documentNumberMasked: '*****5AB',
      documentIssuePlace: '',
      codes: noCodes,
      missingFields: ['documentIssuePlace'],
      codesToComplete: ['type', 'birthComune', 'birthCountry', 'citizenship', 'documentType', 'documentIssuePlace'],
      compositionIssue: null,
      dataSource: 'Host',
      enteredAt: '2026-10-01T08:30:00Z',
    },
    {
      stayGuestId: 'g2',
      position: 1,
      type: 'FamilyMember',
      isMinor: true,
      arrivalDate: '2026-10-10T00:00:00Z',
      stayDays: 3,
      lastName: 'Rossi',
      firstName: 'Luca',
      gender: 'Male',
      dateOfBirth: '2016-02-01T00:00:00Z',
      bornInItaly: false,
      birthComune: '',
      birthProvince: null,
      birthCountry: 'Francia',
      citizenship: 'Italia',
      requiresDocument: false,
      documentType: null,
      documentNumberMasked: null,
      documentIssuePlace: '',
      codes: { ...noCodes, type: '94', birthCountry: '900000101', citizenship: '900000100' },
      missingFields: [],
      codesToComplete: [],
      compositionIssue: null,
      dataSource: 'NotRecorded',
      enteredAt: null,
    },
  ],
};

function renderSummary(canEdit = false, canRevealDocuments = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(AlloggiatiGuestSummary, { bookingId: BOOKING_ID, canEdit, canRevealDocuments }),
    ),
  );
}

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

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('AlloggiatiGuestSummary (CO-11, CO-12)', () => {
  it('guestSummary_Loaded_ShowsOneCardPerGuestWithTheRecordFieldsInOrder', async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue(summary);
    renderSummary();

    const head = await screen.findByTestId('alloggiati-guest-0');
    const fields = within(head)
      .getAllByTestId(/^alloggiati-field-/)
      .map((row) => row.getAttribute('data-testid')!.replace('alloggiati-field-', ''))
      .filter((field) => !field.endsWith('-code-missing'));
    expect(fields).toEqual([
      'type',
      'arrivalDate',
      'stayDays',
      'lastName',
      'firstName',
      'gender',
      'dateOfBirth',
      'birthComune',
      'birthProvince',
      'birthCountry',
      'citizenship',
      'documentType',
      'documentNumber',
      'documentIssuePlace',
    ]);
    expect(within(head).getByTestId('alloggiati-field-type')).toHaveTextContent('Capofamiglia');
    expect(within(head).getByTestId('alloggiati-field-arrivalDate')).toHaveTextContent('10/10/2026');
    expect(within(head).getByTestId('alloggiati-field-gender')).toHaveTextContent('Maschio');
    expect(within(head).getByTestId('alloggiati-field-birthCountry')).toHaveTextContent('Italia');
    expect(within(head).getByTestId('alloggiati-field-documentType')).toHaveTextContent("Carta d'identita'");
    // CO-09: masked like on the guest portal; without guest.read there is no "show" action.
    expect(within(head).getByTestId('alloggiati-field-documentNumber')).toHaveTextContent('*****5AB');
    expect(within(head).queryByTestId('alloggiati-guest-0-reveal-document')).not.toBeInTheDocument();
    expect(within(head).getByTestId('alloggiati-guest-0-entered-by')).toHaveTextContent("Inseriti dall'host il");
    expect(within(screen.getByTestId('alloggiati-guest-1')).queryByTestId('alloggiati-guest-1-entered-by')).not.toBeInTheDocument();
    expect(within(head).getByTestId('alloggiati-field-documentIssuePlace')).toHaveTextContent('Mancante');
    expect(within(head).getByTestId('alloggiati-field-citizenship')).toHaveTextContent('Codice da completare');
    expect(screen.getByTestId('alloggiati-guest-0-status')).toHaveTextContent('1 dato mancante');

    // Family member: no document, born abroad, minor, codes found in the (synthetic) tables.
    const member = screen.getByTestId('alloggiati-guest-1');
    expect(within(member).queryByTestId('alloggiati-field-documentNumber')).not.toBeInTheDocument();
    expect(within(member).queryByTestId('alloggiati-field-birthComune')).not.toBeInTheDocument();
    expect(within(member).getByTestId('alloggiati-field-document-not-required')).toHaveTextContent('Non richiesto');
    expect(within(member).getByTestId('alloggiati-field-birthCountry')).toHaveTextContent('Francia');
    expect(within(member).getByTestId('alloggiati-field-birthCountry')).toHaveTextContent('cod. 900000101');
    expect(within(member).getByText('Minore')).toBeInTheDocument();
    expect(screen.getByTestId('alloggiati-guest-1-status')).toHaveTextContent('Completo');

    expect(screen.getByTestId('alloggiati-unregistered-guests')).toHaveTextContent('1 ospite dichiarato');
    expect(screen.getByTestId('alloggiati-readiness')).toHaveTextContent('Dati incompleti');
    expect(screen.getByTestId('alloggiati-missing-code-tables')).toHaveTextContent('comuni, stati, tipi documento, tipi alloggiato');
    expect(screen.queryByTestId('alloggiati-edit-guests')).not.toBeInTheDocument();
  });

  it('guestSummary_CompleteDataWithCodesToComplete_SaysOnlyTheExportIsBlocked', async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue({ ...summary, dataComplete: true, guests: [summary.guests[1]] });
    renderSummary();

    expect(await screen.findByTestId('alloggiati-readiness')).toHaveTextContent("servono solo per l'esportazione");
  });

  it('guestSummary_MigratedGuestWithoutBirthClassification_ShowsTheOldPlaceToClassify', async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue({
      ...summary,
      guests: [{ ...summary.guests[0], bornInItaly: null, birthComune: 'Firenze', birthProvince: null, missingFields: ['bornInItaly'] }],
    });
    renderSummary();

    const head = await screen.findByTestId('alloggiati-guest-0');
    expect(within(head).getByTestId('alloggiati-field-bornInItaly')).toHaveTextContent('Mancante');
    expect(within(head).getByTestId('alloggiati-field-bornInItaly-legacy')).toHaveTextContent('Firenze');
    expect(within(head).queryByTestId('alloggiati-field-birthComune')).not.toBeInTheDocument();
  });

  it('revealDocument_HostWithGuestRead_ShowsAndCopiesTheFullNumberOnRequest', async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue(summary);
    vi.mocked(alloggiatiApi.getDocumentNumbers).mockResolvedValue([{ position: 0, stayGuestId: 'g1', documentNumber: 'CA12345AB' }]);
    renderSummary(false, true);

    const head = within(await screen.findByTestId('alloggiati-guest-0'));
    expect(head.getByTestId('alloggiati-field-documentNumber')).toHaveTextContent('*****5AB');
    expect(alloggiatiApi.getDocumentNumbers).not.toHaveBeenCalled();

    fireEvent.click(head.getByTestId('alloggiati-guest-0-reveal-document'));

    await waitFor(() => expect(head.getByTestId('alloggiati-field-documentNumber')).toHaveTextContent('CA12345AB'));
    expect(alloggiatiApi.getDocumentNumbers).toHaveBeenCalledWith(BOOKING_ID, 0);
    expect(head.queryByTestId('alloggiati-guest-0-reveal-document')).not.toBeInTheDocument();
  });

  it('editGuests_Host_SavesTheGuestsAndShowsServerErrorsOnTheFields', { timeout: 30_000 }, async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue(summary);
    vi.mocked(alloggiatiApi.getDocumentNumbers).mockResolvedValue([{ position: 0, stayGuestId: 'g1', documentNumber: 'CA12345AB' }]);
    vi.mocked(alloggiatiApi.replaceStayGuests).mockRejectedValueOnce(
      httpError(400, { code: 'validation_error', errors: { 'Guests[0].DocumentIssuePlaceName': ['Campo obbligatorio.'] } }),
    );
    renderSummary(true);

    fireEvent.click(await screen.findByTestId('alloggiati-edit-guests'));
    const dialog = within(await screen.findByTestId('stay-guests-edit-dialog'));
    // Opening the form is the explicit request for the full numbers (audited by the API).
    expect(await dialog.findByLabelText(/^Numero documento/)).toHaveValue('CA12345AB');
    expect(alloggiatiApi.getDocumentNumbers).toHaveBeenCalledWith(BOOKING_ID);
    expect(dialog.getByTestId('stay-guest-1-type')).toHaveTextContent('Familiare');

    fireEvent.change(dialog.getByLabelText(/^Luogo di rilascio/), { target: { value: 'Milano' } });
    fireEvent.click(dialog.getByTestId('stay-guests-save'));

    expect(await dialog.findByText('Campo obbligatorio.')).toBeInTheDocument();
    const [bookingId, guests] = vi.mocked(alloggiatiApi.replaceStayGuests).mock.calls[0];
    expect(bookingId).toBe(BOOKING_ID);
    expect(guests.map((g) => g.type)).toEqual(['HeadOfFamily', 'FamilyMember']);
    expect(guests[0]).toMatchObject({ documentIssuePlaceName: 'Milano', documentNumber: 'CA12345AB' });
    expect(guests[1]).toMatchObject({ bornInItaly: false, birthCountryName: 'Francia', birthCountryCode: '900000101', documentNumber: null });
  });

  it('editGuests_HostWithoutGuestRead_ReentersTheNumberWithTheMaskedHint', { timeout: 30_000 }, async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue(summary);
    vi.mocked(alloggiatiApi.getDocumentNumbers).mockRejectedValue(httpError(403, { code: 'forbidden' }));
    renderSummary(true);

    fireEvent.click(await screen.findByTestId('alloggiati-edit-guests'));
    const dialog = within(await screen.findByTestId('stay-guests-edit-dialog'));

    expect(await dialog.findByLabelText(/^Numero documento/)).toHaveValue('');
    expect(dialog.getByText(/\*\*\*\*\*5AB/)).toBeInTheDocument();
  });

  it('editGuests_DocumentNumbersLoadFails_ShowsErrorAndRetry', async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue(summary);
    vi.mocked(alloggiatiApi.getDocumentNumbers).mockRejectedValue(new Error('boom'));
    renderSummary(true);

    fireEvent.click(await screen.findByTestId('alloggiati-edit-guests'));

    expect(await screen.findByTestId('stay-guests-edit-load-error')).toHaveTextContent('Impossibile caricare i numeri dei documenti');
    expect(screen.queryByTestId('stay-guests-edit-form')).not.toBeInTheDocument();
  });

  it('guestSummary_ApiError_ShowsErrorNotEmpty', async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockRejectedValue(new Error('boom'));
    renderSummary();

    expect(await screen.findByTestId('alloggiati-guest-summary-error')).toHaveTextContent(
      "Impossibile caricare i dati dell'ospite.",
    );
    expect(screen.queryByText('Nessun ospite registrato per questa prenotazione.')).not.toBeInTheDocument();
  });
});
