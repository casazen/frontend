import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { checkInWizardApi } from '@/api/checkin-wizard.api';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import type { CheckInWizardGuest, CheckInWizardState, StayTouristTax } from '@/types/checkin-wizard.types';
import { CheckoutGuestDataSubflow } from '../checkout-guest-data-subflow';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/checkin-wizard.api', () => ({
  checkInWizardApi: { getState: vi.fn(), saveGuests: vi.fn() },
}));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getGuestSummary: vi.fn(), searchCodes: vi.fn(), getStatus: vi.fn() } }));

// The real guests editor of the check-in wizard: a form this size takes a few seconds in jsdom, more on a loaded runner.
configure({ asyncUtilTimeout: 15_000 });
const FORM_TEST_TIMEOUT_MS = 40_000;

const BOOKING_ID = 'c0c1d2e3-0000-4000-8000-000000000041';
const PROPERTY_ID = 'c0c1d2e3-0000-4000-8000-0000000000aa';

function savedGuest(position: number, overrides: Partial<CheckInWizardGuest> = {}): CheckInWizardGuest {
  return {
    saved: true,
    position,
    type: 'SingleGuest',
    firstName: 'Giulia',
    lastName: 'Bianchi',
    gender: 'Female',
    dateOfBirth: '1992-03-08T00:00:00',
    bornInItaly: true,
    birthComuneName: 'Firenze',
    birthProvince: 'FI',
    birthCountryName: '',
    citizenshipName: 'Italia',
    documentType: 'IdentityCard',
    documentNumberMasked: '*****5AB',
    documentIssuePlaceName: 'Firenze',
    dataSource: 'Host',
    ...overrides,
  };
}

const touristTax: StayTouristTax = {
  bookingId: BOOKING_ID,
  status: 'Calculated',
  rateSource: 'Official',
  missingRate: false,
  nights: 2,
  taxableNights: 2,
  ageRulesApply: true,
  categories: [],
  total: 4,
  amountDue: 4,
  collector: 'Host',
  collectorSource: 'Default',
  collectorNeeded: false,
  guests: [{ position: 0, nights: 2, taxableNights: 2, amount: 4, exemptionKind: 'None' }],
  reasons: [],
  stale: false,
};

function wizardState(): CheckInWizardState {
  return {
    booking: {
      bookingId: BOOKING_ID,
      propertyId: PROPERTY_ID,
      propertyName: 'Villa Demo',
      checkIn: '2026-10-10',
      checkOut: '2026-10-12',
      nights: 2,
      source: 'Manual',
      declaredGuests: 1,
      status: 'CheckedIn',
    },
    attendance: 'Present',
    guests: [savedGuest(0)],
    requiredGuestFields: [],
    issues: [],
    tax: touristTax,
    sender: { alloggiatiSender: 'ChannelManager', source: 'Stored', applies: true },
    octorate: { mirrored: false, guests: [], states: [] },
    alloggiati: { status: 'DaInviareManualmente', dataComplete: false, deadlineAt: '2026-10-11T00:00:00Z', isOverdue: false },
    capabilities: { documentReading: false, canRegisterArrival: false, canMarkNoShow: false, octorateTaxValues: false },
    suggestedStep: 'guests',
  };
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onOpenChange = vi.fn();
  render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, null,
          createElement(CheckoutGuestDataSubflow, { bookingId: BOOKING_ID, open: true, onOpenChange })))),
  );
  return { invalidate, onOpenChange };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(checkInWizardApi.getState).mockResolvedValue(wizardState());
  vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue({ missingCodeTables: ['Comuni', 'Stati', 'Documenti', 'TipiAlloggiato'], guests: [] } as never);
  vi.mocked(alloggiatiApi.searchCodes).mockResolvedValue([]);
});

afterEach(cleanup);

describe('CheckoutGuestDataSubflow with the real guests editor of the check-in wizard', () => {
  it('Panel_EditorOfTheCheckInWizard_IsMountedForTheBookingAndSavesThroughTheCheckInEndpoint', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(checkInWizardApi.saveGuests).mockResolvedValue(wizardState());
    const { invalidate, onOpenChange } = renderPanel();

    // The editor of the check-in wizard, for this booking (not a copy: it reads the state of the check-in wizard).
    const card = await screen.findByTestId('stay-guest-0');
    expect(checkInWizardApi.getState).toHaveBeenCalledWith(BOOKING_ID);

    // Something typed and not saved: "Done" does not close over it, and says why.
    fireEvent.change(within(card).getByLabelText(/^Nome/), { target: { value: 'Anna' } });
    fireEvent.click(screen.getByTestId('checkout-guest-data-done'));
    expect(await screen.findByTestId('checkout-guest-data-unsaved')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    // Saved with the "Save guests" of the editor (the editor on its own asks the document too): the check-in endpoint takes the list.
    fireEvent.change(within(await screen.findByTestId('stay-guest-0-document')).getByLabelText(/^Numero documento/), { target: { value: 'CA12345AB' } });
    fireEvent.click(screen.getByTestId('guests-editor-save'));
    await waitFor(() => expect(checkInWizardApi.saveGuests).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(vi.mocked(checkInWizardApi.saveGuests).mock.calls[0])).toContain('Anna');
    expect(await screen.findByTestId('checkout-guest-data-saved')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-guest-data-unsaved')).not.toBeInTheDocument();

    // "Done": the layer is left and the Alloggiati status is asked for again.
    fireEvent.click(screen.getByTestId('checkout-guest-data-done'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [ALLOGGIATI_KEY, 'status', BOOKING_ID] });
  });

  it('Panel_Cancel_LeavesWithoutSavingWhatWasTyped', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    const { onOpenChange } = renderPanel();
    const card = await screen.findByTestId('stay-guest-0');

    fireEvent.change(within(card).getByLabelText(/^Nome/), { target: { value: 'Anna' } });
    fireEvent.click(screen.getByTestId('checkout-guest-data-cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(checkInWizardApi.saveGuests).not.toHaveBeenCalled();
  });
});
