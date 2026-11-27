import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { guestRegisterApi } from '@/api/guest-register.api';
import { DetailDrawerHost } from '@/components/shared/detail-drawer/detail-drawer-host';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import { settleDrawer } from '@/test/drawer';
// The one file the shell loads to register the kinds of the drawer: the layer must be there with no other help.
import '@/config/detail-kinds';

vi.mock('@/api/guest-register.api', () => ({ guestRegisterApi: { getInfo: vi.fn(), download: vi.fn() } }));
vi.mock('@/queries/use-properties', () => ({
  PROPERTIES_KEY: 'properties',
  useProperty: () => ({ data: { name: 'Casa Sciaffusa' } }),
  useUpdateProperty: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
/** The layer is a chunk that loads when the drawer opens: the first time it is also compiled, which is slow on a loaded machine. */
const CHUNK = { timeout: 20_000 };
const SLOW_TEST = { timeout: 40_000 };

function renderAt(address: string, flagOn = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, guestRegistrationRegimes: flagOn }, isLoading: false }}>
        <MemoryRouter initialEntries={[address]}>
          <DetailDrawerHost />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(guestRegisterApi.getInfo).mockResolvedValue({ propertyId: PROPERTY_ID, from: '2026-10-23', to: '2026-11-21', rowCount: 2, retentionYears: 5, regimeCode: 'CH-TI' });
});

afterEach(async () => {
  cleanup();
  await settleDrawer();
});

describe('the layer of the guest register in the detail drawer (E31/F02/US02/T01)', () => {
  it('GuestRegisterDrawer_AddressWithTheProperty_OpensTheRegisterOverThePageOfTheProperty', SLOW_TEST, async () => {
    renderAt(`/app/short-rent/properties/${PROPERTY_ID}?detail=guest-register:${PROPERTY_ID}`);

    expect(await screen.findByRole('dialog', { name: 'Registro ospiti: Casa Sciaffusa' }, CHUNK)).toBeInTheDocument();
    expect(await screen.findByTestId('guest-register-layer', {}, CHUNK)).toBeInTheDocument();
    expect(guestRegisterApi.getInfo).toHaveBeenCalledWith(PROPERTY_ID, expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
  });

  it('GuestRegisterDrawer_TheModuleIsOff_OpensTheLayerThatSaysItIsNotActiveAndAsksNothing', SLOW_TEST, async () => {
    renderAt(`/app/short-rent/properties/${PROPERTY_ID}?detail=guest-register:${PROPERTY_ID}`, false);

    expect(await screen.findByTestId('guest-register-unavailable', {}, CHUNK)).toBeInTheDocument();
    expect(guestRegisterApi.getInfo).not.toHaveBeenCalled();
  });

  it('GuestRegisterDrawer_AnAddressThatIsNotAnId_OpensNothingAndAsksNothing', () => {
    renderAt('/app/short-rent/properties/p1?detail=guest-register:../admin');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(guestRegisterApi.getInfo).not.toHaveBeenCalled();
  });
});
