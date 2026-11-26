import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { swissComplianceApi } from '@/api/swissCompliance.api';
import { DetailDrawerHost } from '@/components/shared/detail-drawer/detail-drawer-host';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { swissDay } from '@/features/compliance/swiss/__tests__/swiss-fixtures';
import i18n from '@/i18n/config';
import { settleDrawer } from '@/test/drawer';
// The one file the shell loads to register the kinds of the drawer: the layer must be there with no other help.
import '@/config/detail-kinds';

vi.mock('@/api/swissCompliance.api', () => ({ swissComplianceApi: { getSwissDay: vi.fn(), declareSwissDay: vi.fn(), undeclareSwissDay: vi.fn() } }));
vi.mock('@/queries/use-properties', () => ({
  PROPERTIES_KEY: 'properties',
  useProperty: () => ({ data: { name: 'Casa Sciaffusa' } }),
  useUpdateProperty: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const DAY = '2026-11-19';
/** The layer is a chunk that loads when the drawer opens: the first time it is also compiled, which is slow on a loaded machine. */
const CHUNK = { timeout: 20_000 };
const SLOW_TEST = { timeout: 40_000 };

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function renderAt(address: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, guestRegistrationRegimes: true }, isLoading: false }}>
        <MemoryRouter initialEntries={[address]}>
          <DetailDrawerHost />
          <Where />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay());
});

afterEach(async () => {
  cleanup();
  await settleDrawer();
});

describe('the layer of the assisted notification in the detail drawer (E31/F02/US02/T02)', () => {
  it('SwissLayerDrawer_AddressWithThePropertyAndTheDay_OpensTheLayerOverTheCockpitNamedAfterTheProperty', SLOW_TEST, async () => {
    renderAt(`/app/short-rent/compliance?detail=swiss-notification:${PROPERTY_ID}:${DAY}`);

    // The layer opens over the page that is open: the address is the cockpit and the drawer is in its `?detail=`.
    expect(await screen.findByRole('dialog', { name: 'Notifica degli ospiti: Casa Sciaffusa' }, CHUNK)).toBeInTheDocument();
    expect(await screen.findByTestId('swiss-layer', {}, CHUNK)).toBeInTheDocument();
    expect(swissComplianceApi.getSwissDay).toHaveBeenCalledWith(PROPERTY_ID, DAY);
    expect(screen.getByTestId('where')).toHaveTextContent(`/app/short-rent/compliance?detail=swiss-notification:${PROPERTY_ID}:${DAY}`);
  });

  it('SwissLayerDrawer_AddressWithTheProperty_AsksTheFirstDayToNotify', SLOW_TEST, async () => {
    renderAt(`/app/short-rent/compliance?detail=swiss-notification:${PROPERTY_ID}`);

    expect(await screen.findByTestId('swiss-layer', {}, CHUNK)).toBeInTheDocument();
    expect(swissComplianceApi.getSwissDay).toHaveBeenCalledWith(PROPERTY_ID, undefined);
  });

  it('SwissLayerDrawer_ContinueLater_ClosesTheLayerAndKeepsThePage', SLOW_TEST, async () => {
    renderAt(`/app/short-rent/compliance?foo=bar&detail=swiss-notification:${PROPERTY_ID}`);

    fireEvent.click(await screen.findByTestId('swiss-later', {}, CHUNK));

    await waitFor(() => expect(screen.queryByTestId('detail-drawer')).not.toBeInTheDocument());
    // The other parameters of the page stay as they were.
    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/compliance?foo=bar');
    expect(screen.getByTestId('where')).not.toHaveTextContent('detail=');
  });

  it('SwissLayerDrawer_AnAddressThatIsNotAnId_OpensNothingAndAsksNothing', () => {
    renderAt('/app/short-rent/compliance?detail=swiss-notification:../admin');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(swissComplianceApi.getSwissDay).not.toHaveBeenCalled();
  });
});
