import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { fetchComplianceSummary } from '@/api/compliance.api';
import type { AppContextKey } from '@/config/route-manifest';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { freezeClock, NOON_UTC } from '@/test/clock';
import type { PropertyStatus } from '@/lib/status-dictionary';
import type { PropertyDetailDto } from '@/types';
import type { ComplianceCockpitAction, ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';
import { PropertyNextStep } from '../components/property-next-step';

vi.mock('@/api/compliance.api', () => ({ fetchComplianceSummary: vi.fn(), fetchComplianceActivation: vi.fn() }));
const workspace = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (contextKey: AppContextKey, permission: string) => contextKey === 'short-rent' && workspace.granted.includes(permission),
  }),
}));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const HOST = ['property.read', 'property.write', 'booking.read', 'booking.write'];
const PHOTO = 'https://ref.supabase.co/storage/v1/object/public/casazen-test-public/properties/p/photos/a.jpg';

const property = (photos: string[] = [PHOTO]): PropertyDetailDto =>
  ({
    id: PROPERTY_ID,
    name: 'Casa Como',
    cinStatus: 'Valid',
    photoUrls: photos,
    pausedAt: null,
    bookingsSummary: { nextCheckIn: null },
  }) as unknown as PropertyDetailDto;

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: undefined, statusText: '', headers: {}, config });
}

const empty = { count: 0, items: [] };
const summaryOf = (parts: Partial<ComplianceSummaryResult>): ComplianceSummaryResult => ({
  propertiesPending: empty,
  guestCheckInsIncomplete: empty,
  checkoutsDue: empty,
  alloggiatiFailures: empty,
  alloggiatiManualRequired: empty,
  turnoversPending: empty,
  ...parts,
});
const item = (action: ComplianceCockpitAction, light: ComplianceSummaryItem['light'], reason: string, extra: Partial<ComplianceSummaryItem> = {}): ComplianceSummaryItem => ({
  id: PROPERTY_ID,
  label: 'Casa Como',
  action,
  propertyId: PROPERTY_ID,
  bookingId: null,
  light,
  reason,
  ...extra,
});
const section = (...items: ComplianceSummaryItem[]) => ({ count: items.length, items });

function renderStep(options: { status?: PropertyStatus; photos?: string[]; canWrite?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        // The card sits on the page of the property, above every tab.
        { initialEntries: [`/app/short-rent/properties/${PROPERTY_ID}`] },
        createElement(PropertyNextStep, {
          property: property(options.photos),
          status: options.status ?? 'Active',
          canWrite: options.canWrite ?? true,
          canReadBookings: workspace.granted.includes('booking.read'),
          onEditCin: vi.fn(),
          onReactivate: vi.fn(),
          reactivating: false,
        }),
      ),
    ),
  );
}

beforeEach(async () => {
  freezeClock(NOON_UTC);
  workspace.granted = HOST;
  await i18n.changeLanguage('it');
  vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({}));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  cleanup();
});

// E03/F03/US01/T02 (NF-52, AC-NF52-9): the property card shows the light of its compliance items, with the same component and words as the page.
describe('PropertyNextStep and the compliance lights of the property', () => {
  // The tourist tax rate leads to the page of the property: the card is on that page and the page has no field for it yet.
  it('PropertyNextStep_RedEnterMunicipalityTaxRate_SaysWhatIsWrongAndOffersNoButtonThatOpensThePageItIsOn', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ connectionsToFix: section(item('EnterMunicipalityTaxRate', 'Red', 'municipality_rate_missing')) }));
    renderStep();

    const block = await screen.findByTestId('property-next-step');
    await waitFor(() => expect(block).toHaveAttribute('data-next-step', 'compliance'));
    expect(block).toHaveTextContent("Inserisci l'imposta di soggiorno del comune: Casa Como");
    expect(block).toHaveTextContent("Non conosciamo l'imposta di soggiorno del comune: inseriscila (non vale zero).");
    expect(block).toHaveAttribute('data-tone', 'warning');
    // A button to `/properties/<id>` would open the page it is on and do nothing: the block leads back to the list and does not say «Tocca a te».
    expect(screen.queryByTestId('property-next-compliance')).not.toBeInTheDocument();
    expect(within(block).queryByRole('link', { name: /Controlla l'invio|Inserisci l'imposta/ })).not.toBeInTheDocument();
    expect(block).not.toHaveTextContent('Tocca a te');
    expect(within(block).getByRole('link', { name: 'Torna agli immobili' })).toHaveAttribute('href', '/app/short-rent/properties');
  });

  // The police send has its place on the page of the property (the connection health, E03/F03/US02/T01): the button leads to that section.
  it('PropertyNextStep_RedActivateOctorateSend_OffersTheButtonThatOpensTheConnectionHealthSection', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ connectionsToFix: section(item('ActivateOctorateSend', 'Red', 'connection_inactive')) }));
    renderStep();

    const block = await screen.findByTestId('property-next-step');
    await waitFor(() => expect(block).toHaveAttribute('data-next-step', 'compliance'));
    expect(block).toHaveTextContent("Attiva l'invio automatico alla Questura: Casa Como");
    expect(block).toHaveTextContent("L'invio automatico non è attivo: attivalo oppure invia tu.");
    expect(screen.getByTestId('property-next-compliance')).toHaveAttribute('href', `/app/short-rent/properties/${PROPERTY_ID}?section=connection-health`);
    expect(block).toHaveTextContent('Tocca a te');
  });

  it('PropertyNextStep_ItemWhosePageIsAnotherOne_KeepsItsButtonAndSaysItIsTheHostsTurn', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ connectionsToFix: section(item('RenewPoliceCredentials', 'Red', 'credentials_refused')) }));
    renderStep();

    const block = await screen.findByTestId('property-next-step');
    await waitFor(() => expect(block).toHaveAttribute('data-next-step', 'compliance'));
    expect(screen.getByTestId('property-next-compliance')).toHaveAttribute('href', '/app/short-rent/alloggiati');
    expect(block).toHaveTextContent('Tocca a te');
  });

  it('PropertyNextStep_OtherLineOfTheSamePage_HasNoButtonWhileTheOnesOfOtherPagesKeepIt', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({
        periodItems: section(item('UploadIstatProof', 'Red', 'deadline_overdue', { period: '2026-08', dueAt: '2026-09-10T00:00:00Z' })),
        // The tourist tax rate leads to the page of the property, which has no field for it yet: no button. The police credentials lead to another page.
        connectionsToFix: section(item('EnterMunicipalityTaxRate', 'Yellow', 'municipality_rate_missing'), item('RenewPoliceCredentials', 'Yellow', 'connection_unverified')),
      }),
    );
    renderStep();

    const lines = await screen.findByTestId('compliance-lines');
    const rows = within(lines).getAllByTestId('compliance-line');
    expect(rows).toHaveLength(2);
    const rate = rows.find((row) => row.getAttribute('data-action') === 'EnterMunicipalityTaxRate')!;
    const credentials = rows.find((row) => row.getAttribute('data-action') === 'RenewPoliceCredentials')!;
    expect(within(rate).queryByTestId('compliance-line-action')).not.toBeInTheDocument();
    expect(within(credentials).getByTestId('compliance-line-action')).toHaveAttribute('href', '/app/short-rent/alloggiati');
  });

  // The police send has its section on the page of the property (E03/F03/US02/T01): the line of the list under the block leads to it as well.
  it('PropertyNextStep_OtherLineAboutThePoliceSend_KeepsItsButtonToTheConnectionHealthSection', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({
        periodItems: section(item('UploadIstatProof', 'Red', 'deadline_overdue', { period: '2026-08', dueAt: '2026-09-10T00:00:00Z' })),
        connectionsToFix: section(item('ActivateOctorateSend', 'Yellow', 'connection_unverified')),
      }),
    );
    renderStep();

    const lines = await screen.findByTestId('compliance-lines');
    const send = within(lines).getByTestId('compliance-line');
    expect(send).toHaveAttribute('data-action', 'ActivateOctorateSend');
    expect(within(send).getByTestId('compliance-line-action')).toHaveAttribute('href', `/app/short-rent/properties/${PROPERTY_ID}?section=connection-health`);
  });

  it('PropertyNextStep_RedMonthOfIstatPastItsDeadline_IsRedAsTheDeadlineAndOpensTheArchive', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({ periodItems: section(item('UploadIstatProof', 'Red', 'deadline_overdue', { period: '2026-08', dueAt: '2026-09-10T00:00:00Z' })) }),
    );
    renderStep();

    const block = await screen.findByTestId('property-next-step');
    await waitFor(() => expect(block).toHaveAttribute('data-next-step', 'compliance'));
    expect(block).toHaveTextContent('Carica la prova ISTAT di agosto 2026: Casa Como');
    expect(block).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByTestId('property-next-compliance')).toHaveAttribute(
      'href',
      `/app/short-rent/alloggiati/reports?kind=IstatProof&property=${PROPERTY_ID}&period=2026-08`,
    );
  });

  it('PropertyNextStep_OtherItems_AreListedWithTheSameLightAndAtMostThreeThenTheRestIsCounted', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({
        connectionsToFix: section(item('ActivateOctorateSend', 'Red', 'connection_inactive'), item('RenewPoliceCredentials', 'Yellow', 'connection_unverified')),
        periodItems: section(
          item('UploadIstatProof', 'Red', 'deadline_overdue', { period: '2026-08' }),
          item('UploadIstatProof', 'Red', 'deadline_overdue', { period: '2026-07' }),
          item('DeclareTouristTax', 'Yellow', 'period_open', { period: '2026-09' }),
        ),
      }),
    );
    renderStep();

    const lines = await screen.findByTestId('compliance-lines');
    // Five items need something: one is the block, three are listed and one is counted.
    expect(within(lines).getAllByTestId('compliance-line')).toHaveLength(3);
    expect(screen.getByTestId('compliance-lines-more')).toHaveTextContent('e 1 altro adempimento');
    expect(within(screen.getByTestId('compliance-lines-more')).getByRole('link')).toHaveAttribute('href', '/app/short-rent/compliance');
    for (const row of within(lines).getAllByTestId('compliance-line')) {
      expect(['red', 'yellow']).toContain(row.getAttribute('data-light'));
      expect(within(row).getByRole('img')).toBeInTheDocument();
    }
  });

  it('PropertyNextStep_EverythingInOrder_CountsWhatTheApiSaysIsInOrderAndKeepsTheStep', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({
        connectionsToFix: section(item('ActivateOctorateSend', 'Green', 'receipt_archived')),
        periodItems: section(item('UploadIstatProof', 'Green', 'receipt_archived', { period: '2026-08' }), item('DeclareTouristTax', 'Green', 'receipt_archived', { period: '2026-08' })),
      }),
    );
    renderStep();

    const lines = await screen.findByTestId('compliance-lines');
    expect(screen.getByTestId('property-next-step')).toHaveAttribute('data-next-step', 'allInOrder');
    // One line that counts what it was given: never «all compliant», the month of ISTAT and tax of a year are many.
    const rows = within(lines).getAllByTestId('compliance-line');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-light', 'green');
    expect(rows[0]).toHaveTextContent('3 adempimenti in regola');
  });

  it('PropertyNextStep_NoItemsOrNoLight_IsTheCardOfAlways', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ connectionsToFix: section(item('ActivateOctorateSend', undefined, '')) }));
    renderStep();

    await waitFor(() => expect(fetchComplianceSummary).toHaveBeenCalled());
    expect(await screen.findByTestId('property-next-step')).toHaveAttribute('data-next-step', 'allInOrder');
    expect(screen.queryByTestId('compliance-lines')).not.toBeInTheDocument();
  });

  it('PropertyNextStep_RedItemAndNoPhotos_TheComplianceItemComesFirst', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ connectionsToFix: section(item('RenewPoliceCredentials', 'Red', 'credentials_refused')) }));
    renderStep({ photos: [] });

    await waitFor(() => expect(screen.getByTestId('property-next-step')).toHaveAttribute('data-next-step', 'compliance'));
    expect(screen.getByTestId('property-next-step')).toHaveTextContent('Aggiorna le credenziali della Questura: Casa Como');
  });

  it('PropertyNextStep_WithoutTheRightToReadTheBookings_NeverAsksTheSummary', async () => {
    workspace.granted = ['property.read', 'property.write'];
    renderStep();

    // The summary asks `booking.read`: a bare 403 on a GET would take the user to «nessun accesso».
    expect(await screen.findByTestId('property-next-step')).toHaveAttribute('data-next-step', 'allInOrder');
    expect(fetchComplianceSummary).not.toHaveBeenCalled();
  });

  it.each(['Pending', 'Suspended'] as const)('PropertyNextStep_%sProperty_NeverAsksTheSummary', async (status) => {
    renderStep({ status });

    await screen.findByTestId('property-next-step');
    expect(fetchComplianceSummary).not.toHaveBeenCalled();
  });

  it('PropertyNextStep_LightsStillLoading_DoesNotSayAllInOrderAndTakeItBack', async () => {
    let answer: (summary: ComplianceSummaryResult) => void = () => {};
    vi.mocked(fetchComplianceSummary).mockReturnValue(new Promise<ComplianceSummaryResult>((resolve) => (answer = resolve)));
    renderStep();

    expect(await screen.findByTestId('property-next-step-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('property-next-step')).not.toBeInTheDocument();

    answer(summaryOf({ connectionsToFix: section(item('ActivateOctorateSend', 'Red', 'connection_inactive')) }));

    await waitFor(() => expect(screen.getByTestId('property-next-step')).toHaveAttribute('data-next-step', 'compliance'));
  });

  // A read that fails is «non lo so», never «tutto in ordine»: the block says it could not check and offers to try again.
  it.each([
    ['a server error', () => httpError(500)],
    ['a 403', () => httpError(403)],
    ['the network', () => new Error('Network Error')],
  ])('PropertyNextStep_SummaryFailsWith%s_SaysItDoesNotKnowNeverAllInOrderAndOffersToTryAgain', async (_what, failure) => {
    vi.mocked(fetchComplianceSummary).mockRejectedValueOnce(failure());
    renderStep();

    const block = await screen.findByTestId('property-next-step');
    expect(block).toHaveAttribute('data-next-step', 'complianceUnavailable');
    expect(block).toHaveTextContent('Non riusciamo a controllare gli adempimenti');
    expect(block).not.toHaveTextContent('Tutto in ordine');
    expect(block).toHaveAttribute('data-tone', 'neutral');

    // «Riprova» reads the lights again: with an answer the card is the one it always is.
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ connectionsToFix: section(item('RenewPoliceCredentials', 'Red', 'credentials_refused')) }));
    fireEvent.click(within(block).getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(screen.getByTestId('property-next-step')).toHaveAttribute('data-next-step', 'compliance'));
    expect(fetchComplianceSummary).toHaveBeenCalledTimes(2);
  });

  it('PropertyNextStep_SummaryNotFound_IsTheTrafficLightOffAndTheCardIsWhatItWas', async () => {
    vi.mocked(fetchComplianceSummary).mockRejectedValue(httpError(404));
    renderStep();

    expect(await screen.findByTestId('property-next-step')).toHaveAttribute('data-next-step', 'allInOrder');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
  });

  it('PropertyNextStep_SummaryFailsAndAStepAsksSomething_SaysThatStepAsItIs', async () => {
    vi.mocked(fetchComplianceSummary).mockRejectedValue(httpError(500));
    renderStep({ photos: [] });

    // A photo is asked, not claimed to be fine: the block is not «tutto in ordine», so there is nothing to take back.
    expect(await screen.findByTestId('property-next-step')).toHaveAttribute('data-next-step', 'addPhotos');
  });

  it('PropertyNextStep_UserWhoMayNotWriteTheProperty_IsLedToThePageNotToldToDoIt', async () => {
    // The page of the item is one this user can open (the archive asks `booking.read`); without `booking.write` the button only opens it («Apri») and
    // the block does not say it is their turn.
    workspace.granted = ['property.read', 'booking.read'];
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ periodItems: section(item('UploadIstatProof', 'Red', 'deadline_overdue', { period: '2026-08' })) }));
    renderStep({ canWrite: false });

    const action = await screen.findByTestId('property-next-compliance');
    expect(action).toHaveTextContent('Apri');
    expect(screen.getByTestId('property-next-step')).not.toHaveTextContent('Tocca a te');
  });

  it('PropertyNextStep_WithLights_HasNoAccessibilityViolation', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({ connectionsToFix: section(item('ActivateOctorateSend', 'Red', 'connection_inactive'), item('RenewPoliceCredentials', 'Yellow', 'connection_unverified')) }),
    );
    const { container } = renderStep();

    await screen.findByTestId('compliance-lines');
    await expectNoAxeViolations(container);
  });
});
