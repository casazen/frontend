import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertyDoorQrApi } from '@/api/checkin.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { PropertyQrCodePage } from '../PropertyQrCode';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/checkin.api', () => ({
  propertyDoorQrApi: { get: vi.fn(), rotate: vi.fn() },
  publicCheckinApi: {},
}));
// The drawing of the code is not what is tested: the image says which address it was made for.
vi.mock('@/lib/qr-print-sheet', () => ({
  useQrDataUrl: (url: string) => (url === '' ? null : `data:image/png;base64,for:${url}`),
  openQrPrintSheet: vi.fn(() => true),
}));

configure({ asyncUtilTimeout: 5_000 });

const PROPERTY = 'property-1';
const FIRST = 'https://casazen.app/checkin/porta/first-door-token';
const SECOND = 'https://casazen.app/checkin/porta/second-door-token';

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function renderPage({ flag = true, canWrite = true }: { flag?: boolean; canWrite?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, checkInIdentityVerification: flag }, isLoading: false }}>
        <WorkspaceContext.Provider
          value={{
            contexts: [],
            activeContext: 'short-rent',
            isReady: true,
            setActiveContext: vi.fn(),
            hasPermission: (_context, permission) => permission === 'property.read' || (canWrite && permission === 'property.write'),
            getDefaultRoute: () => '/app/short-rent',
          }}
        >
          <MemoryRouter initialEntries={[`/app/short-rent/properties/${PROPERTY}/qr`]}>
            <Routes>
              <Route path="/app/short-rent/properties/:propertyId/qr" element={<PropertyQrCodePage />} />
            </Routes>
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

const imageOf = () => screen.getByTestId('property-qr-code').getAttribute('src');

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(propertyDoorQrApi.get).mockResolvedValue({ url: FIRST });
  vi.mocked(propertyDoorQrApi.rotate).mockResolvedValue({ url: SECOND });
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the QR code of the entrance of a property (E22/F02/US01/T01)', () => {
  it('PropertyQrCodePage_FlagOff_IsTheStaticCodeItAlwaysWasAndAsksNothing', () => {
    renderPage({ flag: false });

    expect(imageOf()).toBe(`data:image/png;base64,for:${window.location.origin}/guest/verify?property=${PROPERTY}`);
    expect(screen.queryByTestId('property-door-qr-rotate')).not.toBeInTheDocument();
    expect(propertyDoorQrApi.get).not.toHaveBeenCalled();
  });

  it('PropertyQrCodePage_FlagOn_PrintsTheAddressOfTheDoorThatTheApiMade', async () => {
    renderPage();

    await waitFor(() => expect(imageOf()).toBe(`data:image/png;base64,for:${FIRST}`));
    expect(propertyDoorQrApi.get).toHaveBeenCalledWith(PROPERTY);
    expect(screen.getByText('Codice QR della porta')).toBeInTheDocument();
    expect(screen.getByTestId('property-qr-print')).toBeInTheDocument();
    expect(screen.getByTestId('property-qr-download')).toBeInTheDocument();
  });

  it('PropertyQrCodePage_Regenerate_AsksFirstThenReplacesTheCodeWithTheNewOneAndSaysTheOldStopped', async () => {
    renderPage();
    await waitFor(() => expect(imageOf()).toBe(`data:image/png;base64,for:${FIRST}`));

    fireEvent.click(screen.getByTestId('property-door-qr-rotate'));
    // Nothing is replaced by the first tap: the host is told that the printed code stops working.
    expect(propertyDoorQrApi.rotate).not.toHaveBeenCalled();
    expect(screen.getByText(/smette di funzionare subito/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rigenera il codice' }));

    await waitFor(() => expect(propertyDoorQrApi.rotate).toHaveBeenCalledWith(PROPERTY));
    await waitFor(() => expect(imageOf()).toBe(`data:image/png;base64,for:${SECOND}`));
    expect(toast.success).toHaveBeenCalledWith(i18n.t('property.qr.door.rotated'));
  });

  it('PropertyQrCodePage_RegenerateFails_ReadsTheCodeAgainSoThePageShowsTheOneInForce', async () => {
    vi.mocked(propertyDoorQrApi.rotate).mockRejectedValue(httpError(500));
    renderPage();
    await waitFor(() => expect(imageOf()).toBe(`data:image/png;base64,for:${FIRST}`));
    vi.mocked(propertyDoorQrApi.get).mockResolvedValue({ url: SECOND });

    fireEvent.click(screen.getByTestId('property-door-qr-rotate'));
    fireEvent.click(screen.getByRole('button', { name: 'Rigenera il codice' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('property.qr.door.rotateFailed')));
    // Whether the code was replaced is not known after a failed call: the one that is in force now is what is shown.
    await waitFor(() => expect(imageOf()).toBe(`data:image/png;base64,for:${SECOND}`));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('PropertyQrCodePage_WithoutPermissionToWriteTheProperty_SaysSoAndAsksNothing', () => {
    renderPage({ canWrite: false });

    expect(screen.getByTestId('property-door-qr-message')).toHaveTextContent(i18n.t('property.qr.door.needsWrite'));
    expect(screen.queryByTestId('property-qr-code')).not.toBeInTheDocument();
    expect(propertyDoorQrApi.get).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'property.qr.door.needsWrite'],
    [404, 'property.qr.door.notFound'],
    [500, 'property.qr.door.loadFailed'],
  ])('PropertyQrCodePage_TheAddressAnswers_%i_SaysWhyAndNeverPrintsACodeItCouldNotRead', async (status, key) => {
    vi.mocked(propertyDoorQrApi.get).mockRejectedValue(httpError(status));
    renderPage();

    expect(await screen.findByTestId('property-door-qr-message')).toHaveTextContent(i18n.t(key));
    expect(screen.queryByTestId('property-qr-code')).not.toBeInTheDocument();
  });
});
