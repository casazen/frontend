import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import axios from '@/lib/axios';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { BookingComplianceSection } from '@/features/bookings/booking-compliance-section';
import i18n from '@/i18n/config';
import { COMPLIANCE_ARCHIVE_KEY } from '@/queries/compliance-archive';
import { freezeClock } from '@/test/clock';
import type { ComplianceArchiveEntry, ComplianceBookingArchive, ComplianceProofKind, ReceiptCoverage } from '@/types';
import type { AlloggiatiChannelManagerDto, AlloggiatiStatusDto } from '@/types/alloggiati.types';
import { ProofUploadDialog, type ProofUploadPrefill, type ProofUploadProperty } from '../components/proof-upload-dialog';

// The receipt of the Alloggiati communication covers the flats the host chooses (E20/F02/US02/T01, decision O3). What goes to the server is the proof here: these tests run the
// real api module and the real hooks over a stub of the axios instance, so what they read is the request as it leaves the page (the form fields and the query string).
vi.mock('@/lib/axios', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/axios')>()), default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

// The page of a stay: the status it shows and what the person may do come from here (the connector flag comes from the provider).
const stay = vi.hoisted(() => ({ status: undefined as AlloggiatiStatusDto | undefined, granted: [] as string[] }));
vi.mock('@/queries/use-alloggiati', () => ({ useAlloggiatiStatus: () => ({ data: stay.status, isLoading: false }) }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => context === 'short-rent' && stay.granted.includes(permission) }),
}));

const A = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const B = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const C = '5d1e2f3a-4b5c-4d6e-8f70-81920a1b2c3d';
const D = '7e8f9a0b-1c2d-4e3f-9a4b-5c6d7e8f9a0b';
const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const NAMES: Record<string, string> = { [A]: 'Casa Como', [B]: 'Villa Rosa', [C]: 'Attico Lecco', [D]: 'Chalet Lugano' };
/** The stays each flat has that a receipt of the day would put in order. */
const STAYS: Record<string, number> = { [A]: 2, [B]: 1, [C]: 3, [D]: 0 };
/** The properties of the organization: three in Italy (one with no country, which the server reads as Italian) and one in Switzerland. */
const PROPERTIES: ProofUploadProperty[] = [
  { id: A, name: NAMES[A], country: 'IT' },
  { id: B, name: NAMES[B], country: 'IT' },
  { id: C, name: NAMES[C] },
  { id: D, name: NAMES[D], country: 'CH' },
];
const DAY = '2026-11-14';
const PORTAL = 'https://portal.example.test/ricevute/';

const asked = { coverage: [] as URLSearchParams[] };
const onClose = vi.fn();

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function problem(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: {}, statusText: '', headers: {}, config });
}

/** What the server says a receipt of `DAY` would prove for the flats asked for, in the order asked. */
function coverageOf(params: URLSearchParams): ReceiptCoverage {
  const ids = params.getAll('propertyIds');
  const properties = ids.map((id) => ({ propertyId: id, propertyName: NAMES[id], stays: STAYS[id] }));
  return { day: params.get('day') ?? '', stays: properties.reduce((sum, flat) => sum + flat.stays, 0), properties };
}

/** The answer of the upload of a receipt: the flats it covers and the stays it proves. */
function saved(ids: string[], coveredStays: number | null, kind: ComplianceProofKind = 'AlloggiatiReceipt'): ComplianceArchiveEntry {
  return {
    id: 'proof-1',
    kind,
    propertyId: ids[0],
    propertyName: NAMES[ids[0]],
    day: kind === 'AlloggiatiReceipt' ? DAY : '2026-10-01',
    period: kind === 'AlloggiatiReceipt' ? null : '2026-10',
    source: 'manual_upload',
    receivedAt: '2026-11-15T10:00:00Z',
    retainUntil: '2031-11-15T10:00:00Z',
    contentType: 'application/pdf',
    downloadPath: '/api/compliance/archive/proof-1/download',
    coveredProperties: ids.map((id) => ({ id, name: NAMES[id] })),
    coveredStays,
  };
}

function archiveOf(change: Partial<ComplianceBookingArchive> = {}): ComplianceBookingArchive {
  return { bookingId: BOOKING_ID, propertyId: A, proofs: [], sendLog: [], ...change };
}

interface Answers {
  coverage?: (params: URLSearchParams) => ReceiptCoverage | Promise<ReceiptCoverage>;
  booking?: ComplianceBookingArchive;
}

/** The GET calls of the page, answered by their address; `asked.coverage` keeps the query string of every question about a receipt. */
function answer({ coverage = coverageOf, booking = archiveOf() }: Answers = {}) {
  vi.mocked(axios.get).mockImplementation((async (url: string, config?: { params?: unknown }) => {
    if (url === '/compliance/archive/proofs/coverage') {
      const params = config?.params as URLSearchParams;
      asked.coverage.push(params);
      return { data: await coverage(params) };
    }
    if (url === '/properties') return { data: PROPERTIES };
    if (url === '/compliance/archive') return { data: { items: [], page: 1, pageSize: 1, totalCount: 0, alloggiatiPortalUrl: PORTAL } };
    if (url === `/bookings/${BOOKING_ID}/compliance`) return { data: booking };
    throw new Error(`unexpected GET ${url}`);
  }) as never);
}

/** What the page sent in the one upload: the form it posted. */
function posted(): FormData {
  expect(axios.post).toHaveBeenCalledTimes(1);
  const [url, body] = vi.mocked(axios.post).mock.calls[0];
  expect(url).toBe('/compliance/archive/proofs');
  return body as FormData;
}

interface RenderOptions {
  flags?: Partial<FeatureFlags>;
  prefill?: ProofUploadPrefill;
  kinds?: readonly ComplianceProofKind[];
  client?: QueryClient;
}

function renderDialog({ flags = {}, prefill = { propertyId: A, kind: 'AlloggiatiReceipt', day: DAY }, kinds = ['AlloggiatiReceipt', 'IstatProof'], client = newClient() }: RenderOptions = {}) {
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false }}>
        <ProofUploadDialog open onClose={onClose} properties={PROPERTIES} kinds={kinds} prefill={prefill} alloggiatiPortalUrl={PORTAL} />
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return client;
}

const pdf = (name = 'ricevuta.pdf') => new File(['%PDF-1.4'], name, { type: 'application/pdf' });
const chooseFile = (file = pdf()) => fireEvent.change(screen.getByTestId('proof-upload-file'), { target: { files: [file] } });
const total = () => screen.findByTestId('proof-upload-coverage-total', undefined, { timeout: 5000 });
const lastCoverage = () => asked.coverage[asked.coverage.length - 1];

beforeEach(async () => {
  vi.clearAllMocks();
  asked.coverage.length = 0;
  freezeClock('2026-11-15T12:00:00Z');
  await i18n.changeLanguage('it');
  answer();
  vi.mocked(axios.post).mockResolvedValue({ data: saved([A], 2) });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('the receipt covers the flats the host chose', () => {
  // The data rule: what the host chose is what is asked and what is stored. The summary and the upload speak of the same flats, in the same order, the one the receipt is filed under first;
  // a list is written the way the API reads it (`propertyIds` repeated), and nothing but the day and the flats is in the address of the question.
  it('dialog_ReceiptForSeveralFlats_SendsExactlyTheChosenFlatsAndAsksTheSummaryAboutTheSameOnes', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: saved([A, B], 3) });
    renderDialog();

    expect(await total()).toHaveTextContent('Diventano in regola: 2 soggiorni');
    expect(asked.coverage[0].get('day')).toBe(DAY);
    expect(asked.coverage[0].getAll('propertyIds')).toEqual([A]);
    expect([...new Set(asked.coverage[0].keys())]).toEqual(['day', 'propertyIds']);

    // The flats offered are the Italian ones (the one with no country counts as Italian, as on the server), the one of the request first, ticked and fixed. The Swiss one is not there.
    const flats = screen.getByTestId('proof-upload-flats');
    expect(within(flats).getAllByRole('checkbox').map((box) => box.getAttribute('data-testid'))).toEqual([`proof-upload-flat-${A}`, `proof-upload-flat-${B}`, `proof-upload-flat-${C}`]);
    expect(screen.getByTestId(`proof-upload-flat-${A}`)).toBeDisabled();
    expect(screen.getByTestId(`proof-upload-flat-${A}`)).toHaveAttribute('aria-checked', 'true');
    expect(within(flats).getByText('Casa Como (questo immobile)')).toBeInTheDocument();
    expect(screen.queryByTestId(`proof-upload-flat-${D}`)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`proof-upload-flat-${B}`));

    await waitFor(() => expect(screen.getByTestId('proof-upload-coverage-total')).toHaveTextContent('Diventano in regola: 3 soggiorni'));
    expect(lastCoverage().getAll('propertyIds')).toEqual([A, B]);
    expect(screen.getByTestId('proof-upload-coverage-flats')).toHaveTextContent('Casa Como: 2 soggiorni');
    expect(screen.getByTestId('proof-upload-coverage-flats')).toHaveTextContent('Villa Rosa: 1 soggiorno');

    chooseFile();
    fireEvent.click(screen.getByTestId('proof-upload-submit'));

    const form = await waitFor(() => posted());
    expect(form.get('propertyId')).toBe(A);
    expect(form.get('kind')).toBe('AlloggiatiReceipt');
    expect(form.get('day')).toBe(DAY);
    expect(form.getAll('propertyIds')).toEqual([A, B]);
    expect((form.get('file') as File).name).toBe('ricevuta.pdf');

    // The outcome, after: the flats it covers as the server stored them and the stays it put in order, in the same layer, with one way out.
    const outcome = await screen.findByTestId('proof-upload-outcome');
    expect(within(outcome).getByTestId('proof-upload-outcome-flats')).toHaveTextContent('Casa Como');
    expect(within(outcome).getByTestId('proof-upload-outcome-flats')).toHaveTextContent('Villa Rosa');
    expect(within(outcome).getByTestId('proof-upload-outcome-stays')).toHaveTextContent('3 soggiorni sono ora in regola.');
    expect(screen.queryByTestId('proof-upload-submit')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('proof-upload-outcome-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // A list never means «every flat»: with no other flat ticked the receipt covers the flat of the request alone, and the form carries no list at all.
  it('dialog_ReceiptForOneFlat_SendsNoListOfFlatsNeverEveryFlat', async () => {
    renderDialog();
    expect(await total()).toHaveTextContent('Diventano in regola: 2 soggiorni');

    chooseFile();
    fireEvent.click(screen.getByTestId('proof-upload-submit'));

    const form = await waitFor(() => posted());
    expect(form.get('propertyId')).toBe(A);
    expect(form.getAll('propertyIds')).toEqual([]);
    // Every question about the receipt was about that flat alone (the answer of the upload reads the summary once more, for the same flat).
    expect(asked.coverage.every((params) => params.getAll('propertyIds').join() === A)).toBe(true);
  });

  // The flats are a choice of the receipt of the Alloggiati communication only, and only among flats in Italy: the server refuses a list for another kind of proof or a flat outside Italy
  // among several, so none is ever sent for them (a flat ticked and then left by changing the kind or the flat of the request is not sent either).
  it('dialog_FlatsTickedThenTheKindChanged_AreNotSentWithAProofThatCoversOneFlat', async () => {
    renderDialog();
    await total();
    fireEvent.click(screen.getByTestId(`proof-upload-flat-${B}`));
    await waitFor(() => expect(screen.getByTestId('proof-upload-coverage-total')).toHaveTextContent('Diventano in regola: 3 soggiorni'));

    fireEvent.change(screen.getByTestId('proof-upload-kind'), { target: { value: 'IstatProof' } });
    expect(screen.queryByTestId('proof-upload-flats')).not.toBeInTheDocument();
    expect(screen.queryByTestId('proof-upload-coverage')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('proof-upload-month'), { target: { value: '2026-10' } });
    vi.mocked(axios.post).mockResolvedValue({ data: saved([A], null, 'IstatProof') });
    chooseFile();
    fireEvent.click(screen.getByTestId('proof-upload-submit'));

    const form = await waitFor(() => posted());
    expect(form.get('kind')).toBe('IstatProof');
    expect(form.get('day')).toBe('2026-10-01');
    expect(form.getAll('propertyIds')).toEqual([]);
    // A proof of another kind is done when it is saved: no outcome of stays, the layer closes as it always did.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('dialog_FlatOfTheRequestOutsideItaly_OffersNoOtherFlatAndAsksAboutThatFlatAlone', async () => {
    renderDialog({ prefill: { propertyId: D, kind: 'AlloggiatiReceipt', day: DAY } });

    expect(await total()).toHaveTextContent('Con questa ricevuta non diventa in regola nessun soggiorno.');
    expect(screen.queryByTestId('proof-upload-flats')).not.toBeInTheDocument();
    expect(lastCoverage().getAll('propertyIds')).toEqual([D]);

    chooseFile();
    fireEvent.click(screen.getByTestId('proof-upload-submit'));
    const form = await waitFor(() => posted());
    expect(form.get('propertyId')).toBe(D);
    expect(form.getAll('propertyIds')).toEqual([]);
  });

  it('dialog_FlatOfTheRequestChanged_IsCoveredOnceAndTheOldOneIsOfferedAgain', async () => {
    renderDialog();
    await total();
    fireEvent.click(screen.getByTestId(`proof-upload-flat-${B}`));
    await waitFor(() => expect(lastCoverage().getAll('propertyIds')).toEqual([A, B]));

    // B becomes the flat of the request: it is covered once, A (no longer the request's) is not covered unless the host ticks it again.
    fireEvent.change(screen.getByTestId('proof-upload-property'), { target: { value: B } });

    await waitFor(() => expect(lastCoverage().getAll('propertyIds')).toEqual([B]));
    expect(screen.getByTestId(`proof-upload-flat-${B}`)).toBeDisabled();
    expect(screen.getByTestId(`proof-upload-flat-${A}`)).not.toBeDisabled();
    expect(screen.getByTestId(`proof-upload-flat-${A}`)).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId(`proof-upload-flat-${A}`));
    await waitFor(() => expect(lastCoverage().getAll('propertyIds')).toEqual([B, A]));
  });

  it('dialog_FileDroppedOnTheStep_IsTheFileOfTheReceipt', async () => {
    renderDialog();
    await total();

    fireEvent.drop(screen.getByTestId('proof-upload-drop'), { dataTransfer: { files: [pdf('dal-portale.pdf')], types: ['Files'] } });

    expect(screen.getByTestId('proof-upload-drop')).toHaveTextContent('File scelto: dal-portale.pdf');
    expect(screen.getByTestId('proof-upload-submit')).toBeEnabled();
  });
});

describe('what the host is told before saving and after', () => {
  const nothingYet = () => {
    let resolve!: (value: ReceiptCoverage) => void;
    const promise = new Promise<ReceiptCoverage>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  // The deletion of the photos of the documents cannot be undone: with its flag on the host reads what it will touch before saving and cannot save without it; with the flag off the
  // dialog says nothing of a deletion and waits for nothing (nothing changes).
  it('dialog_DeletionAfterTheReceiptOn_TellsItBeforeSavingAndWaitsForTheSummary', async () => {
    const pending = nothingYet();
    answer({ coverage: () => pending.promise });
    renderDialog({ flags: { purgeDocumentsAfterReceipt: true } });
    chooseFile();

    expect(await screen.findByTestId('proof-upload-coverage-loading')).toBeInTheDocument();
    expect(screen.getByTestId('proof-upload-submit')).toBeDisabled();

    pending.resolve(coverageOf(new URLSearchParams({ day: DAY, propertyIds: A })));

    const warning = await screen.findByTestId('proof-upload-purge-warning');
    expect(warning).toHaveTextContent('cancella le foto dei documenti degli ospiti di questi soggiorni');
    expect(warning).toHaveTextContent('Non si può annullare');
    await waitFor(() => expect(screen.getByTestId('proof-upload-submit')).toBeEnabled());
  });

  it('dialog_DeletionAfterTheReceiptOn_TellsItAfterSavingToo', async () => {
    renderDialog({ flags: { purgeDocumentsAfterReceipt: true } });
    await total();
    chooseFile();
    await waitFor(() => expect(screen.getByTestId('proof-upload-submit')).toBeEnabled());
    fireEvent.click(screen.getByTestId('proof-upload-submit'));

    expect(await screen.findByTestId('proof-upload-outcome-purge')).toHaveTextContent('Non si può annullare');
  });

  it('dialog_DeletionAfterTheReceiptOff_SaysNothingOfADeletionAndDoesNotWaitForTheSummary', async () => {
    const pending = nothingYet();
    answer({ coverage: () => pending.promise });
    renderDialog();
    chooseFile();

    expect(await screen.findByTestId('proof-upload-coverage-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('proof-upload-submit')).toBeEnabled());

    pending.resolve(coverageOf(new URLSearchParams({ day: DAY, propertyIds: A })));
    await total();
    expect(screen.queryByTestId('proof-upload-purge-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('proof-upload-dialog').textContent).not.toMatch(/cancella|cancellat|non si può annullare/i);

    fireEvent.click(screen.getByTestId('proof-upload-submit'));
    expect((await screen.findByTestId('proof-upload-outcome')).textContent).not.toMatch(/cancella|cancellat|non si può annullare/i);
  });

  // The summary is never a number that is not true: a read that fails is a failure with a way to try again (never a count, never the count of an older choice), and a flat the server
  // does not find (404) is told as such whatever the cache still holds of an older read of the same choice.
  it('dialog_SummaryThatFails_IsAFailureWithAWayToTryAgainNeverACount', async () => {
    answer({
      coverage: () => {
        throw problem(500);
      },
    });
    renderDialog();

    const failure = await screen.findByTestId('proof-upload-coverage-error', undefined, { timeout: 5000 });
    expect(failure).toHaveTextContent('Non riusciamo a contare i soggiorni che diventano in regola');
    expect(screen.queryByTestId('proof-upload-coverage')).not.toBeInTheDocument();
    // Nothing irreversible is waiting (the deletion is off): the receipt can still be saved.
    chooseFile();
    expect(screen.getByTestId('proof-upload-submit')).toBeEnabled();

    answer();
    fireEvent.click(within(failure).getByTestId('proof-upload-coverage-retry'));
    expect(await total()).toHaveTextContent('Diventano in regola: 2 soggiorni');
  });

  it('dialog_SummaryThatTurnsIntoA404_IsNotFoundWhateverTheCacheStillHolds', async () => {
    const client = newClient();
    client.setQueryData([COMPLIANCE_ARCHIVE_KEY, 'receipt-coverage', DAY, [A]], coverageOf(new URLSearchParams({ day: DAY, propertyIds: A })));
    answer({
      coverage: () => {
        throw problem(404);
      },
    });
    renderDialog({ client });

    const failure = await screen.findByTestId('proof-upload-coverage-error', undefined, { timeout: 5000 });
    expect(failure).toHaveTextContent('Non troviamo uno degli immobili scelti');
    expect(within(failure).queryByTestId('proof-upload-coverage-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('proof-upload-coverage')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Diventano in regola/);
  });

  it('dialog_DeletionAfterTheReceiptOnAndSummaryThatFails_CannotBeSavedBlind', async () => {
    answer({
      coverage: () => {
        throw problem(500);
      },
    });
    renderDialog({ flags: { purgeDocumentsAfterReceipt: true } });
    chooseFile();

    const failure = await screen.findByTestId('proof-upload-coverage-error', undefined, { timeout: 5000 });
    expect(failure).toHaveTextContent('Prima di salvare serve saperlo');
    expect(screen.getByTestId('proof-upload-submit')).toBeDisabled();
  });

  it('dialog_ReceiptThatPutsNoStayInOrder_SaysSoAndCanStillBeSaved', async () => {
    answer({ coverage: (params) => ({ ...coverageOf(params), stays: 0, properties: [{ propertyId: A, propertyName: NAMES[A], stays: 0 }] }) });
    renderDialog({ flags: { purgeDocumentsAfterReceipt: true } });
    chooseFile();

    expect(await total()).toHaveTextContent('Con questa ricevuta non diventa in regola nessun soggiorno.');
    // No stay, so nothing is deleted: no warning about a deletion.
    expect(screen.queryByTestId('proof-upload-purge-warning')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('proof-upload-submit')).toBeEnabled());
  });
});

describe('the receipt from the page of a stay', () => {
  const ROUTE = `/app/short-rent/bookings/${BOOKING_ID}?tab=guest`;
  const BOOKING = { id: BOOKING_ID, propertyId: A, propertyName: NAMES[A], checkInDate: '2026-11-14T00:00:00Z' };

  function statusOf(change: Partial<AlloggiatiStatusDto> = {}): AlloggiatiStatusDto {
    return {
      bookingId: BOOKING_ID,
      status: 'DaInviareManualmente',
      confirmationNumber: null,
      errorCode: null,
      reportedAt: null,
      deadlineAt: '2026-11-15T08:00:00Z',
      isShortStay: false,
      hoursUntilDeadline: 5,
      isOverdue: false,
      dataComplete: true,
      ...change,
    };
  }

  function renderSection(booking: Parameters<typeof BookingComplianceSection>[0]['booking'] = BOOKING, client = newClient()) {
    render(
      <QueryClientProvider client={client}>
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: true }, isLoading: false }}>
          <MemoryRouter initialEntries={[ROUTE]}>
            <BookingComplianceSection booking={booking} />
          </MemoryRouter>
        </FeatureFlagsContext.Provider>
      </QueryClientProvider>,
    );
    return client;
  }

  beforeEach(() => {
    stay.granted = ['booking.read', 'alloggiati.submit'];
    stay.status = statusOf();
  });

  // The host files the receipt of the day of the stay without leaving the page: the layer opens with the flat and the arrival day chosen, and the guide opens the portal the configuration of
  // the API names. After the upload the page reads again what it shows (the proofs of the stay, the status of the stays).
  it('section_ReceiptOfTheStay_IsFiledFromThePageWithTheArrivalDayAndTheFlatsChosen', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: saved([A, C], 5) });
    const client = renderSection();
    const refreshed = vi.spyOn(client, 'invalidateQueries');

    fireEvent.click(await screen.findByTestId('booking-receipt-upload-open', undefined, { timeout: 5000 }));

    const dialog = await screen.findByTestId('proof-upload-dialog');
    expect(within(dialog).getByTestId('proof-upload-property')).toHaveValue(A);
    expect(within(dialog).getByTestId('proof-upload-day')).toHaveValue(DAY);
    // Only the receipt can be filed from here: no choice of kind.
    expect(within(dialog).queryByTestId('proof-upload-kind')).not.toBeInTheDocument();
    // The address of the portal is the one the API sent with the archive, never one written in the client.
    await waitFor(() => expect(within(dialog).getByTestId('proof-upload-portal-link')).toHaveAttribute('href', PORTAL));
    expect(await total()).toHaveTextContent('Diventano in regola: 2 soggiorni');

    // The other flats arrive with the properties of the organization.
    fireEvent.click(await within(dialog).findByTestId(`proof-upload-flat-${C}`));
    await waitFor(() => expect(screen.getByTestId('proof-upload-coverage-total')).toHaveTextContent('Diventano in regola: 5 soggiorni'));
    chooseFile();
    fireEvent.click(screen.getByTestId('proof-upload-submit'));

    const form = await waitFor(() => posted());
    expect(form.get('propertyId')).toBe(A);
    expect(form.get('day')).toBe(DAY);
    expect(form.getAll('propertyIds')).toEqual([A, C]);
    expect(await screen.findByTestId('proof-upload-outcome')).toHaveTextContent('5 soggiorni sono ora in regola.');
    expect(refreshed).toHaveBeenCalledWith({ queryKey: [COMPLIANCE_ARCHIVE_KEY] });
    expect(refreshed).toHaveBeenCalledWith({ queryKey: ['alloggiati'] });
  });

  // The permission rule is the one of the endpoint (`alloggiati.submit`), and the receipt of a day is offered from that day on, while no archived receipt covers the stay.
  const NOT_OFFERED: Array<{ name: string; granted?: string[]; booking?: Parameters<typeof renderSection>[0]; status?: AlloggiatiStatusDto }> = [
    { name: 'WithoutThePermissionToSendTheGuestsData', granted: ['booking.read'] },
    { name: 'ForAnArrivalThatHasNotComeYet', booking: { ...BOOKING, checkInDate: '2026-11-16T00:00:00Z' } },
    { name: 'ForAStayOfWhichTheArrivalDayIsNotKnown', booking: { id: BOOKING_ID, propertyId: A } },
    {
      name: 'ForAStayAnArchivedReceiptCovers',
      status: statusOf({ channelManager: { receiptCoverage: { archived: true, source: 'manual_upload', archivedAt: '2026-11-15T09:00:00Z' } } as unknown as AlloggiatiChannelManagerDto }),
    },
  ];

  it.each(NOT_OFFERED)('section_ReceiptUpload$name_IsNotOffered', async ({ granted, booking, status }) => {
    stay.granted = granted ?? stay.granted;
    stay.status = status ?? stay.status;
    renderSection(booking);

    await screen.findByTestId('booking-compliance-section', undefined, { timeout: 5000 });
    expect(screen.queryByTestId('booking-receipt-upload-open')).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('section_LineOfTheDocumentsDeleted_SaysCasaZenDidItWithTheDateAndNeverSent', async () => {
    answer({
      booking: archiveOf({ sendLog: [{ id: 'gone', kind: 'DocumentsDeleted', sender: 'CasaZen', sentAt: '2026-11-15T09:30:00Z', reference: null, sentBy: null }] }),
    });
    renderSection();

    const row = await screen.findByTestId('send-log-row-gone', undefined, { timeout: 5000 });
    expect(row).toHaveTextContent('Documenti cancellati dopo la ricevuta');
    expect(row).toHaveTextContent('Fatto da CasaZen');
    expect(row).toHaveTextContent('15 novembre 2026');
    expect(row.textContent ?? '').not.toMatch(/inviato/i);
  });
});
