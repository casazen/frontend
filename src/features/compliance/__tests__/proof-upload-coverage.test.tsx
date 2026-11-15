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
const E = '2c3d4e5f-6a7b-4c8d-9e0f-a1b2c3d4e5f6';
const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const NAMES: Record<string, string> = { [A]: 'Casa Como', [B]: 'Villa Rosa', [C]: 'Attico Lecco', [D]: 'Chalet Lugano', [E]: 'Villa Lunga' };
/** The stays each flat has that a receipt of the day would put in order. */
const STAYS: Record<string, number> = { [A]: 2, [B]: 1, [C]: 3, [D]: 0 };
/**
 * The properties of the organization as the list of the API gives them: an id, a name and how the flat is let, no country (the API does not send one). Three are in Italy and `D` is in
 * Switzerland, which only the server knows: it refuses `D` among several flats (see `serverSays`). `E` is let long-term: it owes no communication and is never offered.
 */
const PROPERTIES: ProofUploadProperty[] = [
  { id: A, name: NAMES[A], rentalMode: 'Short' },
  { id: B, name: NAMES[B], rentalMode: 'Short' },
  { id: C, name: NAMES[C], rentalMode: 'Short' },
  { id: D, name: NAMES[D], rentalMode: 'Short' },
  { id: E, name: NAMES[E], rentalMode: 'Long' },
];
const DAY = '2026-11-14';
const PORTAL = 'https://portal.example.test/ricevute/';

const asked = { coverage: [] as URLSearchParams[], properties: [] as unknown[] };
const onClose = vi.fn();

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function problem(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: code ? { code } : {}, statusText: '', headers: {}, config });
}

/** What the server says a receipt of `DAY` would prove for the flats asked for, in the order asked. */
function coverageOf(params: URLSearchParams): ReceiptCoverage {
  const ids = params.getAll('propertyIds');
  const properties = ids.map((id) => ({ propertyId: id, propertyName: NAMES[id], stays: STAYS[id] }));
  return { day: params.get('day') ?? '', stays: properties.reduce((sum, flat) => sum + flat.stays, 0), properties };
}

/** The server as it is: a flat outside Italy (here `D`) is refused among several flats (422), whatever the list of the API says of it. */
function serverSays(params: URLSearchParams): ReceiptCoverage {
  const ids = params.getAll('propertyIds');
  if (ids.length > 1 && ids.includes(D)) throw problem(422, 'compliance_proof_coverage_invalid');
  return coverageOf(params);
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
function answer({ coverage = serverSays, booking = archiveOf() }: Answers = {}) {
  vi.mocked(axios.get).mockImplementation((async (url: string, config?: { params?: unknown }) => {
    if (url === '/compliance/archive/proofs/coverage') {
      const params = config?.params as URLSearchParams;
      asked.coverage.push(params);
      return { data: await coverage(params) };
    }
    if (url === '/properties') {
      // The list as the API would give it unfiltered: a page that does not ask for the short-rent flats gets the long-term one too.
      asked.properties.push(config?.params);
      return { data: PROPERTIES };
    }
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
  properties?: ProofUploadProperty[];
}

function renderDialog({
  flags = {},
  prefill = { propertyId: A, kind: 'AlloggiatiReceipt', day: DAY },
  kinds = ['AlloggiatiReceipt', 'IstatProof'],
  client = newClient(),
  properties = PROPERTIES,
}: RenderOptions = {}) {
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false }}>
        <ProofUploadDialog open onClose={onClose} properties={properties} kinds={kinds} prefill={prefill} alloggiatiPortalUrl={PORTAL} />
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
  asked.properties.length = 0;
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

    // The flats offered are the ones of the list, one by one, the one of the request first, ticked and fixed. The list says nothing of the country, so none is left out, and there is no
    // button that ticks them all: a receipt covers the flats the host chose.
    const flats = screen.getByTestId('proof-upload-flats');
    expect(within(flats).getAllByRole('checkbox').map((box) => box.getAttribute('data-testid'))).toEqual([`proof-upload-flat-${A}`, `proof-upload-flat-${B}`, `proof-upload-flat-${C}`, `proof-upload-flat-${D}`]);
    expect(screen.getByTestId(`proof-upload-flat-${A}`)).toBeDisabled();
    expect(screen.getByTestId(`proof-upload-flat-${A}`)).toHaveAttribute('aria-checked', 'true');
    expect(within(flats).getByText('Casa Como (questo immobile)')).toBeInTheDocument();
    expect(screen.queryByTestId('proof-upload-flats-all')).not.toBeInTheDocument();
    expect(within(flats).getByText(/solo se sono tutti in Italia/)).toBeInTheDocument();

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

  // The flats are a choice of the receipt of the Alloggiati communication only: the server refuses a list for another kind of proof, so none is ever sent for it (a flat ticked and then
  // left by changing the kind or the flat of the request is not sent either).
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

  // The list of the API says nothing of the country of a flat, so a flat outside Italy (here `D`) is offered like the others and only the server knows it: it refuses it among several flats
  // (422 `compliance_proof_coverage_invalid`). The summary then says plainly what a receipt can cover and how to take the flat off, with no «Riprova» (asking again would get the same), and
  // the summary and the save come back as soon as the flat is off: nothing stays blocked.
  it('dialog_FlatOutsideItalyTicked_SummaryRefusalSaysWhatAReceiptCoversAndHowToTakeTheFlatOffThenTheSaveComesBack', async () => {
    renderDialog({ flags: { purgeDocumentsAfterReceipt: true } });
    expect(await total()).toHaveTextContent('Diventano in regola: 2 soggiorni');
    chooseFile();

    fireEvent.click(screen.getByTestId(`proof-upload-flat-${D}`));

    const refusal = await screen.findByTestId('proof-upload-coverage-error', undefined, { timeout: 5000 });
    expect(refusal).toHaveTextContent('Una ricevuta può valere per più immobili solo se sono tutti in Italia');
    expect(refusal).toHaveTextContent('Togli la spunta agli immobili che non sono in Italia');
    expect(within(refusal).queryByTestId('proof-upload-coverage-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('proof-upload-coverage')).not.toBeInTheDocument();
    expect(lastCoverage().getAll('propertyIds')).toEqual([A, D]);
    // The server refused the question itself: going on without the count would be refused the same way, so no confirmation is offered (taking the flat off mends it).
    expect(screen.queryByTestId('proof-upload-coverage-go-on')).not.toBeInTheDocument();
    expect(screen.getByTestId('proof-upload-submit')).toBeDisabled();

    fireEvent.click(screen.getByTestId(`proof-upload-flat-${D}`));

    expect(await total()).toHaveTextContent('Diventano in regola: 2 soggiorni');
    expect(screen.queryByTestId('proof-upload-coverage-error')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('proof-upload-submit')).toBeEnabled());
  });

  // The same refusal can come with the save (the host went on without waiting for the summary): it is told in the same words, in the layer, and the flat can be taken off to save again.
  it('dialog_UploadRefusedBecauseAFlatIsOutsideItaly_SaysSoAndTheHostCanTakeTheFlatOffAndSaveAgain', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(problem(422, 'compliance_proof_coverage_invalid'));
    renderDialog();
    await total();
    fireEvent.click(screen.getByTestId(`proof-upload-flat-${D}`));
    chooseFile();
    fireEvent.click(screen.getByTestId('proof-upload-submit'));

    const error = await screen.findByTestId('proof-upload-error');
    expect(error).toHaveTextContent('Una ricevuta può valere per più immobili solo se sono tutti in Italia');
    expect(error).toHaveTextContent('Togli la spunta agli immobili che non sono in Italia');
    expect(screen.getByTestId('proof-upload-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`proof-upload-flat-${D}`));

    expect(screen.queryByTestId('proof-upload-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('proof-upload-submit')).toBeEnabled();
    fireEvent.click(screen.getByTestId('proof-upload-submit'));
    expect(await screen.findByTestId('proof-upload-outcome')).toBeInTheDocument();
    expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(2);
    expect((vi.mocked(axios.post).mock.calls[1][1] as FormData).getAll('propertyIds')).toEqual([]);
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

  // A flat let long-term owes no Alloggiati communication: it is not offered to cover, nor to file the receipt under, even when the list handed to the dialog is not filtered. (The backend
  // hides a receipt from a collaborator who does not reach every flat it covers, so a flat that has no business there would take it away from the short-rent team.)
  it('dialog_FlatLetLongTerm_IsNeverOfferedToCoverNorToFileTheReceiptUnder', async () => {
    renderDialog();
    await total();

    expect(screen.queryByTestId(`proof-upload-flat-${E}`)).not.toBeInTheDocument();
    expect(within(screen.getByTestId('proof-upload-property')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      "Scegli l'immobile",
      NAMES[A],
      NAMES[B],
      NAMES[C],
      NAMES[D],
    ]);
    expect(screen.getByTestId('proof-upload-flats')).not.toHaveTextContent(NAMES[E]);
  });

  // The summary is a GET that carries the id of every flat in its address (about 49 characters each) and the server reads a request line of at most 8 KB, which is about 160 flats: the dialog lets
  // a receipt name at most 100, says so, and the question about 100 flats still fits the request line.
  it('dialog_MoreFlatsThanASummaryCanCarry_CannotBeTickedAndTheLimitIsSaid', async () => {
    const many: ProofUploadProperty[] = Array.from({ length: 102 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `Casa ${index}`,
      rentalMode: 'Short' as const,
    }));
    answer({ coverage: (params) => ({ day: DAY, stays: 0, properties: params.getAll('propertyIds').map((id) => ({ propertyId: id, propertyName: id, stays: 0 })) }) });
    renderDialog({ properties: many, prefill: { propertyId: many[0].id, kind: 'AlloggiatiReceipt', day: DAY } });
    await total();
    expect(screen.getByTestId('proof-upload-flats')).toHaveTextContent('al massimo 100');
    expect(screen.queryByTestId('proof-upload-flats-limit')).not.toBeInTheDocument();

    // The flat of the request and 99 more: a hundred.
    for (const flat of many.slice(1, 100)) fireEvent.click(screen.getByTestId(`proof-upload-flat-${flat.id}`));

    await waitFor(() => expect(lastCoverage().getAll('propertyIds')).toHaveLength(100));
    expect(await screen.findByTestId('proof-upload-flats-limit')).toHaveTextContent('al massimo per 100 immobili');
    expect(screen.getByTestId(`proof-upload-flat-${many[100].id}`)).toBeDisabled();
    expect(screen.getByTestId(`proof-upload-flat-${many[101].id}`)).toBeDisabled();
    expect(screen.getByTestId(`proof-upload-flat-${many[99].id}`)).toBeEnabled();
    expect(lastCoverage().toString().length).toBeLessThan(8 * 1024 - 512);

    // A flat taken off opens the place again.
    fireEvent.click(screen.getByTestId(`proof-upload-flat-${many[99].id}`));
    await waitFor(() => expect(screen.queryByTestId('proof-upload-flats-limit')).not.toBeInTheDocument());
    expect(screen.getByTestId(`proof-upload-flat-${many[100].id}`)).toBeEnabled();
  }, 30_000);

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
    // Nothing irreversible is waiting (the deletion is off): the receipt can still be saved, with nothing to confirm.
    chooseFile();
    expect(screen.getByTestId('proof-upload-submit')).toBeEnabled();
    expect(screen.queryByTestId('proof-upload-coverage-go-on')).not.toBeInTheDocument();

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

  // With the deletion on, a summary that cannot be read shuts the save and says why. It does not shut it for good: the host can try again, or confirm that the deletion cannot be undone and save
  // without the count, for that choice of flats only (another choice asks it again).
  it('dialog_DeletionAfterTheReceiptOnAndSummaryThatFails_SaysWhyTheSaveWaitsAndOnlyAConfirmationOpensIt', async () => {
    answer({
      coverage: () => {
        throw problem(500);
      },
    });
    renderDialog({ flags: { purgeDocumentsAfterReceipt: true } });
    chooseFile();

    const failure = await screen.findByTestId('proof-upload-coverage-error', undefined, { timeout: 5000 });
    expect(failure).toHaveTextContent('Non riusciamo a contare i soggiorni che diventano in regola');
    expect(failure).toHaveTextContent('si cancellano le foto dei documenti degli ospiti');
    expect(within(failure).getByTestId('proof-upload-coverage-retry')).toBeEnabled();
    expect(screen.getByTestId('proof-upload-submit')).toBeDisabled();
    expect(screen.getByTestId('proof-upload-coverage-go-on')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByTestId('proof-upload-coverage-go-on'));

    await waitFor(() => expect(screen.getByTestId('proof-upload-submit')).toBeEnabled());
    fireEvent.click(screen.getByTestId('proof-upload-submit'));
    const form = await waitFor(() => posted());
    expect(form.get('propertyId')).toBe(A);
    expect(form.getAll('propertyIds')).toEqual([]);
  });

  it('dialog_ConfirmationToSaveWithoutTheCount_IsForThatChoiceOfFlatsOnly', async () => {
    answer({
      coverage: () => {
        throw problem(500);
      },
    });
    renderDialog({ flags: { purgeDocumentsAfterReceipt: true } });
    chooseFile();
    await screen.findByTestId('proof-upload-coverage-error', undefined, { timeout: 5000 });
    fireEvent.click(screen.getByTestId('proof-upload-coverage-go-on'));
    await waitFor(() => expect(screen.getByTestId('proof-upload-submit')).toBeEnabled());

    fireEvent.click(screen.getByTestId(`proof-upload-flat-${B}`));

    // Another choice of flats is another question: its summary fails too, and the host confirms again.
    await waitFor(() => expect(screen.getByTestId('proof-upload-submit')).toBeDisabled());
    expect(await screen.findByTestId('proof-upload-coverage-go-on', undefined, { timeout: 5000 })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('proof-upload-submit')).toBeDisabled();
  });

  // A failure that has a reason of its own (here a refusal of the permission) still says why the save waits, and the way on is the same.
  it('dialog_DeletionAfterTheReceiptOnAndSummaryRefusedForAReasonOfItsOwn_StillSaysWhyTheSaveWaits', async () => {
    answer({
      coverage: () => {
        throw problem(403);
      },
    });
    renderDialog({ flags: { purgeDocumentsAfterReceipt: true } });
    chooseFile();

    const failure = await screen.findByTestId('proof-upload-coverage-error', undefined, { timeout: 5000 });
    expect(failure).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    expect(failure).toHaveTextContent('si cancellano le foto dei documenti degli ospiti');
    expect(screen.getByTestId('proof-upload-coverage-go-on')).toBeInTheDocument();
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

    // The other flats arrive with the properties of the organization: the short-rent ones, asked for as such (the list is not unfiltered), and none let long-term.
    fireEvent.click(await within(dialog).findByTestId(`proof-upload-flat-${C}`));
    expect(asked.properties).toEqual([{ mode: 'short' }]);
    expect(within(dialog).queryByTestId(`proof-upload-flat-${E}`)).not.toBeInTheDocument();
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
