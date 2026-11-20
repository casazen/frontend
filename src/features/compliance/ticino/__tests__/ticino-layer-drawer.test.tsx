import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { swissComplianceApi } from '@/api/swissCompliance.api';
import { DetailDrawerHost } from '@/components/shared/detail-drawer/detail-drawer-host';
import i18n from '@/i18n/config';
import { settleDrawer } from '@/test/drawer';
import type { TicinoNotificationDay } from '@/types/swissCompliance.types';
// The one file the shell loads to register the kinds of the drawer: the layer must be there with no other help.
import '@/config/detail-kinds';

vi.mock('@/api/swissCompliance.api', () => ({
  swissComplianceApi: {
    getTicinoDay: vi.fn(),
    downloadTicinoFile: vi.fn(),
    downloadGroupSheet: vi.fn(),
    declareTicinoDay: vi.fn(),
    undeclareTicinoDay: vi.fn(),
    uploadReceipt: vi.fn(),
  },
}));
vi.mock('@/queries/use-properties', () => ({
  PROPERTIES_KEY: 'properties',
  useProperty: () => ({ data: { name: 'Casa Lugano' } }),
  useUpdateProperty: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const DAY = '2026-11-19';
/** The layer is a chunk that loads when the drawer opens: the first time it is also compiled, which is slow on a loaded machine. */
const CHUNK = { timeout: 20_000 };
const SLOW_TEST = { timeout: 40_000 };

const day: TicinoNotificationDay = {
  propertyId: PROPERTY_ID,
  day: DAY,
  structureId: 'NL-12345678',
  stayCount: 1,
  rows: [{ bookingId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', guestName: 'Mario Rossi', personsOver14: 0, personsUnder14: 0, kind: 'guest', groupSize: 0 }],
  issues: [],
  xmlAvailable: true,
  receiptCount: 0,
  dueAt: '2026-11-20T14:00:00Z',
  reference: `TI-${PROPERTY_ID.replaceAll('-', '')}-20261119`,
  portalUrl: 'https://www.notifiche.ti.ch',
  pendingDays: [{ day: DAY, stayCount: 1, dueAt: '2026-11-20T14:00:00Z' }],
  warnings: [],
  csvCharset: 'windows-1252',
  transliteratedCount: 0,
  declaredAt: null,
  declaredBy: null,
  fileGeneratedAt: null,
  fileGeneratedCount: 0,
  alreadyDeclared: false,
};

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function renderAt(address: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[address]}>
        <DetailDrawerHost />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(day);
});

afterEach(async () => {
  cleanup();
  await settleDrawer();
});

describe('the layer of the Ticino notification in the detail drawer (E30/F02/US03/T02)', () => {
  it('TicinoLayerDrawer_AddressWithThePropertyAndTheDay_OpensTheLayerNamedAfterTheProperty', SLOW_TEST, async () => {
    renderAt(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}:${DAY}`);

    // The layer opens over the page that is open: the address is the cockpit and the drawer is in its `?detail=`.
    expect(await screen.findByRole('dialog', { name: 'Notifica alla polizia: Casa Lugano' }, CHUNK)).toBeInTheDocument();
    expect(await screen.findByTestId('ticino-layer', {}, CHUNK)).toBeInTheDocument();
    expect(swissComplianceApi.getTicinoDay).toHaveBeenCalledWith(PROPERTY_ID, DAY);
    expect(screen.getByTestId('where')).toHaveTextContent(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}:${DAY}`);
  });

  it('TicinoLayerDrawer_AddressWithTheProperty_AsksTheFirstDayToNotify', SLOW_TEST, async () => {
    renderAt(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);

    expect(await screen.findByTestId('ticino-layer', {}, CHUNK)).toBeInTheDocument();
    expect(swissComplianceApi.getTicinoDay).toHaveBeenCalledWith(PROPERTY_ID, undefined);
  });

  it('TicinoLayerDrawer_AnAddressThatIsNotAnId_OpensNothingAndAsksNothing', async () => {
    renderAt('/app/short-rent/compliance?detail=ticino:../admin');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(swissComplianceApi.getTicinoDay).not.toHaveBeenCalled();
  });

  it('TicinoLayerDrawer_ContinueLater_ClosesTheLayerAndKeepsThePage', SLOW_TEST, async () => {
    renderAt(`/app/short-rent/compliance?foo=bar&detail=ticino:${PROPERTY_ID}:${DAY}`);

    fireEvent.click(await screen.findByTestId('ticino-later', {}, CHUNK));

    await waitFor(() => expect(screen.queryByTestId('detail-drawer')).not.toBeInTheDocument());
    // The other parameters of the page stay as they were.
    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/compliance?foo=bar');
    expect(screen.getByTestId('where')).not.toHaveTextContent('detail=');
  });
});
