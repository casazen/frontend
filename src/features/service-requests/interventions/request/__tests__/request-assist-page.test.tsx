import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { fetchHostSupplierServices, fetchHostSupplierSlots } from '@/api/host-supplier-catalog.api';
import { propertiesApi } from '@/api/properties.api';
import { fetchServiceCategories } from '@/api/service-categories.api';
import { serviceRequestAssistApi } from '@/api/service-request-assist.api';
import { createServiceRequest, fetchMarketplaceSuppliers, fetchSuppliersByProperty } from '@/api/service-requests.api';
import { NOON_UTC, freezeClock } from '@/test/clock';
import type { Property } from '@/types';
import type { SupplierPicker } from '@/types/service-request';
import type { ServiceRequestAssist } from '@/types/service-request-assist';
import { RequestInterventionPage } from '../request-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/api/bookings.api', () => ({
  asBookingPage: (data: unknown) => ({ items: Array.isArray(data) ? data : [], totalCount: 0, page: 1, pageSize: 10 }),
  bookingsApi: { getAll: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: vi.fn() }));
vi.mock('@/api/service-requests.api', () => ({
  createServiceRequest: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
  fetchMarketplaceSuppliers: vi.fn(),
}));
vi.mock('@/api/host-supplier-catalog.api', () => ({ fetchHostSupplierServices: vi.fn(), fetchHostSupplierSlots: vi.fn() }));
vi.mock('@/api/service-request-assist.api', () => ({ serviceRequestAssistApi: { getAvailability: vi.fn(), assist: vi.fn() } }));

const PROPERTY_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const SUPPLIER_ID = '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b';
const SERVICE_ID = '3f2a9c1e-7b1d-4c3a-9e2f-0a1b2c3d4e5f';
const WAIT = { timeout: 5000 };
const WORDS = 'Il rubinetto della cucina perde, serve qualcuno domani mattina';

const property = { id: PROPERTY_ID, name: 'Casa Mare', city: 'Rimini', address: 'Via Roma 1', comuneIstatCode: '099014' } as Property;
const supplier = {
  orgId: SUPPLIER_ID,
  legalName: 'Idraulica Rossi',
  phone: '',
  email: '',
  categories: ['plumbing'],
  comuni: ['Rimini'],
  photoUrls: [],
  priceFromCents: 6000,
  priceFromUnit: 'PerJob',
  medianResponseMinutes: 120,
} as SupplierPicker;
const service = {
  id: SERVICE_ID,
  name: 'Riparazione di una perdita',
  category: 'plumbing',
  durationMinutes: 120,
  priceFromCents: 6000,
  priceUnit: 'PerJob' as const,
  requiresQuote: false,
  estimatedAmountCents: 6000,
};

const PLUMBING: ServiceRequestAssist = {
  aiUsed: true,
  reason: null,
  category: 'plumbing',
  urgency: 'High',
  summary: 'Il rubinetto della cucina perde acqua: serve un intervento domani mattina.',
  explanation: 'Una perdita al rubinetto è un lavoro da idraulico e conviene sistemarla presto.',
  channel: 'casazen',
  casazenSuppliers: 2,
};

const NOTHING = (reason: NonNullable<ServiceRequestAssist['reason']>): ServiceRequestAssist => ({
  aiUsed: false,
  reason,
  category: null,
  urgency: null,
  summary: null,
  explanation: null,
  channel: null,
  casazenSuppliers: 0,
});

function renderPage(query = `propertyId=${PROPERTY_ID}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const url = `/app/short-rent/interventions/request${query ? `?${query}` : ''}`;
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [url] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/interventions/request', element: createElement(RequestInterventionPage) }),
          )))),
  );
}

const next = () => fireEvent.click(screen.getByTestId('request-next'));
const stepIs = (id: string) => waitFor(() => expect(screen.getByTestId('request-wizard')).toHaveAttribute('data-step', id), WAIT);

/** Opens the box of the AI and asks it about `text`; resolves with the answer on screen (a proposal or the reason there is none). */
async function describeTheJob(text = WORDS) {
  fireEvent.click(await screen.findByTestId('request-assist-open', undefined, WAIT));
  fireEvent.change(await screen.findByTestId('request-assist-text', undefined, WAIT), { target: { value: text } });
  const submit = screen.getByTestId('request-assist-submit');
  await waitFor(() => expect(submit).toBeEnabled(), WAIT);
  fireEvent.click(submit);
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  freezeClock(NOON_UTC);
  await i18n.changeLanguage('it');
  vi.mocked(fetchServiceCategories).mockResolvedValue(['cleaning', 'plumbing']);
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property]);
  vi.mocked(bookingsApi.getAll).mockResolvedValue([] as never);
  vi.mocked(fetchSuppliersByProperty).mockResolvedValue({ items: [supplier], totalCount: 1, page: 1, pageSize: 20 });
  vi.mocked(fetchMarketplaceSuppliers).mockResolvedValue({ items: [supplier], totalCount: 1, page: 1, pageSize: 20 });
  vi.mocked(fetchHostSupplierServices).mockResolvedValue({ items: [service] });
  vi.mocked(fetchHostSupplierSlots).mockImplementation(async (_supplier, _service, params) => ({
    serviceId: SERVICE_ID,
    durationMinutes: 120,
    from: params.date ?? null,
    to: params.date ?? null,
    slots: [{ startUtc: `${params.date}T08:00:00Z`, endUtc: `${params.date}T10:00:00Z` }],
  }));
  vi.mocked(serviceRequestAssistApi.getAvailability).mockResolvedValue({ available: true });
  vi.mocked(serviceRequestAssistApi.assist).mockResolvedValue(PLUMBING);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RequestInterventionPage, «Descrivi di cosa hai bisogno» (WIZ-AI-REQUEST)', { timeout: 30000 }, () => {
  it('RequestAssist_WhereNoAiIsInEffect_IsNotThere_AndTheStepIsTheOneItAlwaysWas', async () => {
    vi.mocked(serviceRequestAssistApi.getAvailability).mockResolvedValue({ available: false });
    renderPage();

    await stepIs('channel');
    await screen.findByTestId('request-channel-casazen', undefined, WAIT);
    await waitFor(() => expect(serviceRequestAssistApi.getAvailability).toHaveBeenCalledTimes(1), WAIT);
    expect(screen.queryByTestId('request-assist')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-assist-open')).not.toBeInTheDocument();
  });

  it('RequestAssist_WhenTheReadOfTheAvailabilityFails_IsNotThereEither', async () => {
    vi.mocked(serviceRequestAssistApi.getAvailability).mockRejectedValue(new Error('network'));
    renderPage();

    await screen.findByTestId('request-channel-casazen', undefined, WAIT);
    await waitFor(() => expect(serviceRequestAssistApi.getAvailability).toHaveBeenCalled(), WAIT);
    expect(screen.queryByTestId('request-assist')).not.toBeInTheDocument();
  });

  it('RequestAssist_DescribingTheJob_ProposesTheService_AndTheHostTakesTheProposal', async () => {
    renderPage();

    // Under the two choices, quiet: the host opens it only if they want to tell the job in words.
    expect(await screen.findByTestId('request-assist', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('request-assist-text')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('request-assist-open'));
    // Too few words: nothing to ask yet.
    expect(await screen.findByTestId('request-assist-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('request-assist-text'), { target: { value: 'perde' } });
    expect(screen.getByTestId('request-assist-submit')).toBeDisabled();

    fireEvent.change(screen.getByTestId('request-assist-text'), { target: { value: WORDS } });
    await waitFor(() => expect(screen.getByTestId('request-assist-submit')).toBeEnabled(), WAIT);
    fireEvent.click(screen.getByTestId('request-assist-submit'));

    const result = await screen.findByTestId('request-assist-result', undefined, WAIT);
    expect(serviceRequestAssistApi.assist).toHaveBeenCalledWith({ propertyId: PROPERTY_ID, text: WORDS });
    expect(within(result).getByTestId('request-assist-category')).toHaveTextContent('Idraulico');
    expect(within(result).getByTestId('request-assist-urgency')).toHaveTextContent('Alta');
    expect(within(result).getByTestId('request-assist-who')).toHaveTextContent('2 fornitori CasaZen della tua zona');
    expect(within(result).getByTestId('request-assist-note')).toHaveTextContent('Il rubinetto della cucina perde acqua: serve un intervento domani mattina.');
    expect(result).toHaveTextContent('Una perdita al rubinetto è un lavoro da idraulico');
    // It says that an AI wrote it.
    expect(screen.getByTestId('ai-content-notice')).toBeInTheDocument();
    // Nothing is decided yet: the wizard has not moved and nothing was sent.
    expect(screen.getByTestId('request-wizard')).toHaveAttribute('data-step', 'channel');
    expect(createServiceRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('request-assist-use'));

    // The wizard goes on from the proposals, with the service and the channel the AI proposed.
    await stepIs('proposals');
    expect(await screen.findByTestId('request-ai-choice')).toHaveTextContent("L'AI ha scelto: Idraulico.");
    expect(vi.mocked(fetchSuppliersByProperty).mock.calls.some((call) => call[1] === 'plumbing')).toBe(true);

    // The urgency and the sentence for the supplier are the answers of the details, which the host can still change.
    fireEvent.click(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT));
    next();
    await stepIs('details');
    expect(await screen.findByTestId('request-urgency-High', undefined, WAIT)).toBeChecked();
    expect(screen.getByTestId('request-notes')).toHaveValue('Il rubinetto della cucina perde acqua: serve un intervento domani mattina.');
  });

  it('RequestAssist_WhenNoCasazenSupplierCovers_TheProposalLeadsToThePartners', async () => {
    vi.mocked(serviceRequestAssistApi.assist).mockResolvedValue({ ...PLUMBING, category: 'cleaning', channel: 'external', casazenSuppliers: 0 });
    renderPage();

    await describeTheJob('Serve una pulizia di fine soggiorno per sabato');
    const result = await screen.findByTestId('request-assist-result', undefined, WAIT);
    expect(within(result).getByTestId('request-assist-who')).toHaveTextContent('Un partner esterno');
    expect(screen.getByTestId('request-assist-use')).toHaveTextContent('Vedi i partner');

    fireEvent.click(screen.getByTestId('request-assist-use'));

    await stepIs('partners');
    expect(await screen.findByTestId('request-partners', undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('request-ai-choice')).toHaveTextContent("L'AI ha scelto: Pulizie.");
    // The path of the partners sends nothing to CasaZen.
    expect(createServiceRequest).not.toHaveBeenCalled();
  });

  it('RequestAssist_Change_GoesBackToTheServices_AndAnotherChoiceTakesTheLineAway', async () => {
    renderPage();
    await describeTheJob();
    fireEvent.click(await screen.findByTestId('request-assist-use', undefined, WAIT));
    await stepIs('proposals');

    fireEvent.click(await screen.findByTestId('request-ai-choice-change', undefined, WAIT));

    await stepIs('service');
    // What the AI chose is chosen, and the host picks another one.
    expect(await screen.findByTestId('request-category-plumbing', undefined, WAIT)).toBeChecked();
    fireEvent.click(screen.getByTestId('request-category-cleaning'));
    next();
    await stepIs('proposals');
    expect(screen.queryByTestId('request-ai-choice')).not.toBeInTheDocument();
  });

  it('RequestAssist_AJobTheAiCannotTell_SaysSo_WithoutARetry_AndTheWordsComeBack', async () => {
    vi.mocked(serviceRequestAssistApi.assist).mockResolvedValue(NOTHING('ai_not_understood'));
    renderPage();

    await describeTheJob('Mi serve una cosa per la casa');

    const none = await screen.findByTestId('request-assist-none', undefined, WAIT);
    expect(none).toHaveAttribute('data-reason', 'ai_not_understood');
    expect(none).toHaveTextContent('Non sono riuscito a capire di che lavoro si tratta');
    expect(screen.queryByTestId('request-assist-retry')).not.toBeInTheDocument();
    expect(screen.getByTestId('request-wizard')).toHaveAttribute('data-step', 'channel');

    // «Cambia le parole»: the box comes back with what was written.
    fireEvent.click(screen.getByTestId('request-assist-edit'));
    expect(await screen.findByTestId('request-assist-text')).toHaveValue('Mi serve una cosa per la casa');
  });

  it('RequestAssist_AServiceThatTheCatalogDoesNotHave_IsAJobTheWizardCannotUse', async () => {
    vi.mocked(serviceRequestAssistApi.assist).mockResolvedValue({ ...PLUMBING, category: 'pool' });
    renderPage();

    await describeTheJob();

    expect(await screen.findByTestId('request-assist-none', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('request-assist-use')).not.toBeInTheDocument();
  });

  it('RequestAssist_WhenTheAiDidNotAnswer_OffersANewTry', async () => {
    vi.mocked(serviceRequestAssistApi.assist).mockResolvedValueOnce(NOTHING('ai_unavailable'));
    renderPage();

    await describeTheJob();

    const none = await screen.findByTestId('request-assist-none', undefined, WAIT);
    expect(none).toHaveAttribute('data-reason', 'ai_unavailable');
    fireEvent.click(within(none).getByTestId('request-assist-retry'));

    expect(await screen.findByTestId('request-assist-result', undefined, WAIT)).toBeInTheDocument();
    expect(serviceRequestAssistApi.assist).toHaveBeenCalledTimes(2);
  });

  it.each(['ai_budget_exhausted', 'ai_not_configured'] as const)(
    'RequestAssist_%s_SaysTheAdviceIsNotThereNow_AndTheHostChoosesAsAlways',
    async (reason) => {
      vi.mocked(serviceRequestAssistApi.assist).mockResolvedValue(NOTHING(reason));
      renderPage();

      await describeTheJob();

      const none = await screen.findByTestId('request-assist-none', undefined, WAIT);
      expect(none).toHaveTextContent('non è disponibile al momento');
      expect(screen.queryByTestId('request-assist-retry')).not.toBeInTheDocument();
      // «Scelgo io» folds the box away: the two choices are what is left.
      fireEvent.click(screen.getByTestId('request-assist-skip'));
      expect(await screen.findByTestId('request-assist-open')).toBeInTheDocument();
      expect(screen.getByTestId('request-channel-casazen')).toBeInTheDocument();
    },
  );

  it('RequestAssist_WhenTheRequestFails_ShowsTheError_AndTheWordsStay', async () => {
    vi.mocked(serviceRequestAssistApi.assist).mockRejectedValueOnce(new Error('boom'));
    renderPage();

    await describeTheJob();

    const error = await screen.findByTestId('request-assist-error', undefined, WAIT);
    expect(error).toHaveTextContent('Non riesco a leggere la tua descrizione adesso.');
    expect(screen.getByTestId('request-assist-text')).toHaveValue(WORDS);

    fireEvent.click(within(error).getByTestId('request-assist-retry'));
    expect(await screen.findByTestId('request-assist-result', undefined, WAIT)).toBeInTheDocument();
  });

  it('RequestAssist_NotesTheHostWroteAreNotOverwrittenByTheSentenceOfTheAi', async () => {
    renderPage();
    await describeTheJob();
    fireEvent.click(await screen.findByTestId('request-assist-use', undefined, WAIT));
    await stepIs('proposals');
    fireEvent.click(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT));
    next();
    await stepIs('details');

    // The host rewrote the notes, went back to the first steps and asked the AI again: their own words stay.
    fireEvent.change(await screen.findByTestId('request-notes', undefined, WAIT), { target: { value: 'Le chiavi sono dal portiere.' } });
    fireEvent.click(screen.getByTestId('request-back'));
    await stepIs('proposals');
    fireEvent.click(screen.getByTestId('request-back'));
    await stepIs('service');
    fireEvent.click(screen.getByTestId('request-back'));
    await stepIs('channel');
    // The words come back in the box.
    const box = await screen.findByTestId('request-assist-text', undefined, WAIT);
    expect(box).toHaveValue(WORDS);
    fireEvent.change(box, { target: { value: `${WORDS}, anche il lavandino` } });
    fireEvent.click(screen.getByTestId('request-assist-submit'));
    fireEvent.click(await screen.findByTestId('request-assist-use', undefined, WAIT));
    await stepIs('proposals');
    next();
    await stepIs('details');

    expect(await screen.findByTestId('request-notes', undefined, WAIT)).toHaveValue('Le chiavi sono dal portiere.');
  });
});
