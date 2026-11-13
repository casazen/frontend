import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { ComplianceDrawerButton } from '../compliance-drawer-button';
import { originKeyOf } from '../compliance-drawer-model';
import { RETURN_STORAGE_KEY, resetReturnForTests, saveReturn } from '../compliance-drawer-return';
import { ComplianceDrawerReturn } from '../compliance-drawer-welcome';

vi.mock('@/api/octorate-compliance-handoff.api', () => ({
  octorateComplianceHandoffApi: { start: vi.fn() },
}));

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (contextKey: AppContextKey, permission: string) => contextKey === 'short-rent' && permission === 'booking.read',
  }),
}));

const PROPERTY = '22222222-2222-2222-2222-222222222222';
const BOOKING = '11111111-1111-1111-1111-111111111111';
const OTHER_BOOKING = '33333333-3333-3333-3333-333333333333';
const TARGET = { topic: 'Alloggiati', propertyId: PROPERTY, bookingId: BOOKING } as const;
const ORIGIN = originKeyOf(TARGET);

const ROUTE = '/app/short-rent/compliance';
const FILTERS = '?tab=alloggiati';
const ELSEWHERE = '/app/short-rent/dashboard';
const FAR_FUTURE = '2099-01-01T00:00:00Z';

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{`${pathname}${search}`}</p>;
}

function renderShell(initial: string, target = TARGET) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: true }, isLoading: false }}>
        <MemoryRouter initialEntries={[initial]}>
          <ComplianceDrawerReturn />
          <LocationProbe />
          <Link to="/app/short-rent/properties">Altrove</Link>
          <Link to={`${ROUTE}${FILTERS}`}>Di nuovo agli adempimenti</Link>
          <Routes>
            <Route path="*" element={<ComplianceDrawerButton target={target} subject="Mario Rossi" />} />
          </Routes>
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

/** The browser shows the page: `persisted` when it brings it back from its memory (the back button of a page that left in the same tab). */
function pageshow(persisted: boolean) {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  act(() => {
    window.dispatchEvent(event);
  });
}

const keepWhereTheHostWas = (over: Partial<Parameters<typeof saveReturn>[0]> = {}) =>
  saveReturn({ handoffId: 'hf_5b0e2c9a41d94c63a8d1', route: ROUTE, filters: FILTERS, origin: ORIGIN, expiresAt: FAR_FUTURE, ...over });

beforeEach(() => {
  window.sessionStorage.clear();
  resetReturnForTests();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ComplianceDrawerReturn', () => {
  it('return_RecordOfTheTab_PutsTheHostBackOnTheRouteWithItsFiltersTakesTheFocusBackAndWelcomesThem', async () => {
    keepWhereTheHostWas();

    renderShell(ELSEWHERE);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`${ROUTE}${FILTERS}`));
    const notice = await screen.findByTestId('compliance-drawer-welcome');
    expect(notice).toHaveTextContent('Bentornato nel Cassetto Compliance');
    expect(notice).toHaveTextContent('non lo importa');
    // The control that started the handoff is where the host is put back.
    await waitFor(() => expect(screen.getByTestId('compliance-drawer-trigger')).toHaveFocus());
    // Restored once: what the tab kept is forgotten.
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();
  });

  it('return_Welcome_AsksNothingRecordsNoResultAndChangesNoState', async () => {
    keepWhereTheHostWas();

    renderShell(ELSEWHERE);
    const notice = await screen.findByTestId('compliance-drawer-welcome');

    expect(notice).not.toHaveTextContent(/inviato\?/i);
    expect(notice.querySelector('input, textarea, select')).toBeNull();
    // The only button of the notice closes it: there is no «sì, è andato a buon fine».
    expect(notice.querySelectorAll('button')).toHaveLength(1);
    expect(octorateComplianceHandoffApi.start).not.toHaveBeenCalled();
  });

  it('return_HostAlreadyOnThePage_StaysThereAndIsStillWelcomed', async () => {
    keepWhereTheHostWas();

    renderShell(`${ROUTE}${FILTERS}`);

    expect(await screen.findByTestId('compliance-drawer-welcome')).toHaveTextContent('Bentornato nel Cassetto Compliance');
    expect(screen.getByTestId('location')).toHaveTextContent(`${ROUTE}${FILTERS}`);
    await waitFor(() => expect(screen.getByTestId('compliance-drawer-trigger')).toHaveFocus());
  });

  it('return_RouteOfTheRecordWithOtherFilters_BringsTheFiltersBack', async () => {
    keepWhereTheHostWas();

    renderShell(ROUTE);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`${ROUTE}${FILTERS}`));
  });

  it('return_ExpiredRecord_IsNotRestoredAndSaysNothing', async () => {
    keepWhereTheHostWas({ expiresAt: '2020-01-01T00:00:00Z' });

    renderShell(ELSEWHERE);

    expect(screen.getByTestId('location')).toHaveTextContent(ELSEWHERE);
    expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();
  });

  it('return_RecordWithAnAddressOutsideTheApp_IsNotFollowed', () => {
    window.sessionStorage.setItem(
      RETURN_STORAGE_KEY,
      JSON.stringify({ handoffId: 'hf_1', route: 'https://octorate.example/panel', filters: '', origin: ORIGIN, expiresAt: Date.now() + 60_000 }),
    );

    renderShell(ELSEWHERE);

    expect(screen.getByTestId('location')).toHaveTextContent(ELSEWHERE);
    expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument();
  });

  it('return_NoRecord_ChangesNothingOnThePage', () => {
    renderShell(ELSEWHERE);

    expect(screen.getByTestId('location')).toHaveTextContent(ELSEWHERE);
    expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument();
    expect(screen.getByTestId('compliance-drawer-trigger')).not.toHaveFocus();
  });

  it('return_ControlOfAnotherStay_DoesNotTakeTheFocus', async () => {
    keepWhereTheHostWas();

    renderShell(ELSEWHERE, { topic: 'Alloggiati', propertyId: PROPERTY, bookingId: OTHER_BOOKING });

    await screen.findByTestId('compliance-drawer-welcome');
    expect(screen.getByTestId('compliance-drawer-trigger')).not.toHaveFocus();
  });

  it('return_HostMovesOn_TheNoticeGoesAndALaterVisitToThePageIsNotAReturn', async () => {
    keepWhereTheHostWas();
    renderShell(ELSEWHERE);
    await screen.findByTestId('compliance-drawer-welcome');

    fireEvent.click(screen.getByRole('link', { name: 'Altrove' }));
    await waitFor(() => expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: 'Di nuovo agli adempimenti' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`${ROUTE}${FILTERS}`));
    expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument();
  });

  it('return_PageBroughtBackFromTheBrowsersMemory_RestoresWhatTheTabKeptOnceAndALaterShowRestoresNothing', async () => {
    renderShell(ELSEWHERE);
    keepWhereTheHostWas();

    // A page shown as any other is not a return: what the tab kept waits.
    pageshow(false);
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).not.toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(ELSEWHERE);
    expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument();

    // The browser brings the page back from its memory: the host is put back, welcomed, and what the tab kept is forgotten.
    pageshow(true);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`${ROUTE}${FILTERS}`));
    expect(await screen.findByTestId('compliance-drawer-welcome')).toHaveTextContent('Bentornato nel Cassetto Compliance');
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();

    // Once: the host moves on, and the page coming back from the memory again with nothing kept brings them nowhere.
    fireEvent.click(screen.getByRole('link', { name: 'Altrove' }));
    await waitFor(() => expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument());
    pageshow(true);
    expect(screen.getByTestId('location')).toHaveTextContent('/app/short-rent/properties');
    expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument();
  });

  it('return_Dismissed_ClosesTheNotice', async () => {
    keepWhereTheHostWas();
    renderShell(ELSEWHERE);

    fireEvent.click(await screen.findByTestId('compliance-drawer-welcome-dismiss'));

    expect(screen.queryByTestId('compliance-drawer-welcome')).not.toBeInTheDocument();
  });
});
