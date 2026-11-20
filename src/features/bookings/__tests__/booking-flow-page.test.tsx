import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { bookingFlowSettingsApi } from '@/api/booking-flow-settings.api';
import type { ContextBootstrapDto } from '@/api/contexts';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { contextOf } from '@/test/org-contexts';
import type { BookingFlowSettings } from '@/types/booking-flow.types';
import { BookingFlowPage } from '../booking-flow-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/booking-flow-settings.api', () => ({ bookingFlowSettingsApi: { get: vi.fn(), update: vi.fn() } }));

configure({ asyncUtilTimeout: 5_000 });

const DEFAULTS: BookingFlowSettings = {
  checkInLinkMode: 'Automatic',
  checkInLinkDaysBefore: 3,
  maxCheckInLinkDaysBefore: 7,
  arrivalMode: 'Automatic',
  departureMode: 'Automatic',
  propertyReadyMode: 'Automatic',
  propertyReadyTrigger: 'CleaningDone',
  isDefault: true,
};

function workspaceOf(contexts: ContextBootstrapDto[]): WorkspaceContextValue {
  return { contexts, activeContext: 'short-rent', isReady: true, setActiveContext: vi.fn(), hasPermission: () => true, getDefaultRoute: () => '/app/short-rent' };
}

function renderPage(contexts: ContextBootstrapDto[] = [contextOf('short-rent')]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrap = (children: ReactNode) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/short-rent/bookings/flow']}>
          <WorkspaceContext.Provider value={workspaceOf(contexts)}>{children}</WorkspaceContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
  return render(wrap(<BookingFlowPage />));
}

describe('BookingFlowPage (casazen/backend#978)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(bookingFlowSettingsApi.get).mockResolvedValue(DEFAULTS);
    vi.mocked(bookingFlowSettingsApi.update).mockImplementation(async (request) => ({ ...DEFAULTS, ...request, isDefault: false }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('BookingFlowPage_Defaults_ListsEveryStepWithTheAutomaticOnes', async () => {
    renderPage();

    await screen.findByTestId('booking-flow-form');
    for (const step of ['confirmation', 'checkInLink', 'guestData', 'arrival', 'alloggiati', 'departure', 'cleaning', 'propertyReady']) {
      expect(screen.getByTestId(`booking-flow-step-${step}`)).toBeInTheDocument();
    }
    for (const step of ['checkInLink', 'arrival', 'departure', 'propertyReady']) {
      expect(screen.getByTestId(`booking-flow-switch-${step}`)).toHaveAttribute('data-state', 'checked');
    }
    // The legal steps carry no switch: CasaZen never does them in the host's place.
    expect(screen.queryByTestId('booking-flow-switch-alloggiati')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-flow-days')).toHaveValue(3);
    expect(screen.getByTestId('booking-flow-save')).toBeDisabled();
  });

  it('BookingFlowPage_LinkSwitchedToManual_SavesItAndHidesTheDays', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('booking-flow-switch-checkInLink'));
    expect(screen.queryByTestId('booking-flow-days')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('booking-flow-save'));

    await waitFor(() => expect(bookingFlowSettingsApi.update).toHaveBeenCalledWith(expect.objectContaining({ checkInLinkMode: 'Manual', arrivalMode: 'Automatic' })));
  });

  it('BookingFlowPage_DaysBeyondTheLifeOfALink_CannotBeSaved', async () => {
    renderPage();

    fireEvent.change(await screen.findByTestId('booking-flow-days'), { target: { value: '9' } });

    expect(screen.getByTestId('booking-flow-save')).toBeDisabled();
    expect(bookingFlowSettingsApi.update).not.toHaveBeenCalled();
  });

  it('BookingFlowPage_NotTheAdministrator_ReadsWithoutChanging', async () => {
    renderPage([contextOf('short-rent', 'property_manager')]);

    expect(await screen.findByTestId('booking-flow-read-only')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-flow-save')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-flow-switch-arrival')).toBeDisabled();
  });
});
