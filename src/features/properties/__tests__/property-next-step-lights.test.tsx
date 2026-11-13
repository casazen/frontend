import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
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
        null,
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
  it('PropertyNextStep_RedPoliceSend_IsTheNextStepWithItsButton', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ connectionsToFix: section(item('ActivateOctorateSend', 'Red', 'connection_inactive')) }));
    renderStep();

    const block = await screen.findByTestId('property-next-step');
    await waitFor(() => expect(block).toHaveAttribute('data-next-step', 'compliance'));
    expect(block).toHaveTextContent("Attiva l'invio automatico alla Questura: Casa Como");
    expect(block).toHaveTextContent("L'invio automatico non è attivo: attivalo oppure invia tu.");
    expect(block).toHaveTextContent('Tocca a te');
    expect(block).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByTestId('property-next-compliance')).toHaveAttribute('href', `/app/short-rent/properties/${PROPERTY_ID}`);
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

  it('PropertyNextStep_SummaryFails_SaysWhatItAlwaysSaidAndNothingAsAnError', async () => {
    vi.mocked(fetchComplianceSummary).mockRejectedValue(new Error('boom'));
    renderStep();

    expect(await screen.findByTestId('property-next-step')).toHaveAttribute('data-next-step', 'allInOrder');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('PropertyNextStep_UserWhoMayNotWriteTheProperty_IsLedToThePageNotToldToDoIt', async () => {
    // The page of the item is one this user can open (every reader of the card holds `property.read`); without `property.write` the button only
    // opens it («Apri») and the block does not say it is their turn.
    workspace.granted = ['property.read', 'booking.read'];
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ connectionsToFix: section(item('ActivateOctorateSend', 'Red', 'connection_inactive')) }));
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
