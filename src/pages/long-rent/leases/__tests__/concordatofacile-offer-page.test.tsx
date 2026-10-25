import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { ConcordatoFacileOfferPage } from '../concordatofacile-offer-page';
import { GuidedContractRedirect } from '../guided-contract-redirect';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const leaseId = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const FORM_URL = `https://form.example.test/?leaseId=${leaseId}&expiresAt=2026-10-25T10%3A00%3A00Z&signature=abc123`;
const accessUrl = `/leases/${leaseId}/concordatofacile/access`;
const linkUrl = `/leases/${leaseId}/concordatofacile/link`;
const giftUrl = `/leases/${leaseId}/concordatofacile/consume-gift`;
const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

function httpError(status: number, data: object = {}): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', headers: {}, config, data: { status, ...data } });
}

/** The page at `path`, in StrictMode like the app in development: the effects run twice, the link must still be asked once. */
function renderGuided(flags: Partial<FeatureFlags>, path = `/app/long-rent/leases/${leaseId}/guided-contract`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value = { flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false };
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <FeatureFlagsContext.Provider value={value}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/app/long-rent/leases/:id/guided-contract" element={<ConcordatoFacileOfferPage />} />
              <Route path="/app/long-rent/leases/:id/concordatofacile" element={<GuidedContractRedirect />} />
              <Route path="/app/long-rent/leases/:id" element={<div data-testid="lease-sheet-stub" />} />
            </Routes>
          </MemoryRouter>
        </FeatureFlagsContext.Provider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

type Source = 'payment' | 'gift' | 'admin' | null;
/** What the server says about the access: where it comes from (none yet), whether the privacy notice was accepted, whether a gift is there. */
interface Access {
  source: Source;
  privacy?: boolean;
  gift?: boolean;
}

/** The lease and the access as `access()` says now; anything else is a 404. */
function mockService(access: () => Access) {
  get.mockImplementation((url: string) => {
    if (url === `/leases/${leaseId}`) {
      return Promise.resolve({ data: { id: leaseId, propertyId: 'property-1', property: { id: 'property-1', name: 'Casa Trastevere', city: 'Roma' }, status: 'Draft' } });
    }
    if (url === accessUrl) {
      const { source, privacy = true, gift = false } = access();
      return Promise.resolve({ data: { hasAccess: source !== null, source, giftAvailable: gift, giftConsumed: false, privacyAccepted: privacy } });
    }
    return Promise.reject(httpError(404));
  });
}

const linkCalls = () => post.mock.calls.filter(([url]) => url === linkUrl);

describe('ConcordatoFacileOfferPage (CF-FIX, CF-FLOW): the page of payment', () => {
  let assign: Mock;
  let replace: Mock;
  let open: MockInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    assign = vi.fn();
    replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign, replace });
    open = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    open.mockRestore();
    vi.unstubAllGlobals();
  });

  it('with the service off the address goes back to the contract and nothing asks the service', async () => {
    renderGuided({ concordatoFacile: false });

    expect(await screen.findByTestId('lease-sheet-stub')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  // CF-FLOW: the form opens from the sheet. Whoever already has the access and opens this address (a bookmark, "back" of the browser)
  // is sent back there, whatever the source of the access, and the page does not open the form by itself.
  it.each<Source>(['admin', 'payment', 'gift'])('with the access active (%s) a visit to this address goes back to the sheet and opens nothing', async (source) => {
    mockService(() => ({ source }));

    renderGuided({ concordatoFacile: true });

    expect(await screen.findByTestId('lease-sheet-stub')).toBeInTheDocument();
    expect(linkCalls()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    // Nothing of the old screens: no banner of the administrator, no «Accedi alla pratica».
    expect(screen.queryByRole('button', { name: 'Accedi alla pratica' })).not.toBeInTheDocument();
  });

  // The act of the person that opens the form from here: back from the payment. The link is asked once and this tab goes to it.
  it('back from the payment (the old address, the result kept) it asks for the link ONCE and takes this tab to it, with no other click', async () => {
    mockService(() => ({ source: 'payment' }));
    post.mockResolvedValue({ data: { url: FORM_URL } });

    renderGuided({ concordatoFacile: true }, `/app/long-rent/leases/${leaseId}/concordatofacile?checkout=success`);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(FORM_URL));
    expect(linkCalls()).toHaveLength(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByText(/Pagamento completato/)).not.toBeInTheDocument();
  });

  it('back from the payment the access is waited for (the webhook can come after the person): the form opens as soon as it is there', async () => {
    let recorded = false;
    mockService(() => ({ source: recorded ? 'payment' : null }));
    post.mockResolvedValue({ data: { url: FORM_URL } });

    renderGuided({ concordatoFacile: true }, `/app/long-rent/leases/${leaseId}/guided-contract?checkout=success`);

    expect(await screen.findByText(i18n.t('guidedContract.paymentReceived'))).toBeInTheDocument();
    expect(linkCalls()).toHaveLength(0);
    // The payment is recorded after the person is back: the next reading (the access is read again every two seconds) finds it.
    recorded = true;
    await waitFor(() => expect(replace).toHaveBeenCalledWith(FORM_URL), { timeout: 6000 });
    expect(linkCalls()).toHaveLength(1);
  }, 15_000);

  it('back from the payment with the privacy notice not accepted the sheet is the place: nothing is opened from here', async () => {
    mockService(() => ({ source: 'payment', privacy: false }));

    renderGuided({ concordatoFacile: true }, `/app/long-rent/leases/${leaseId}/guided-contract?checkout=success`);

    expect(await screen.findByTestId('lease-sheet-stub')).toBeInTheDocument();
    expect(linkCalls()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
  });

  it('the gift practice used on this page goes on to the form, once', async () => {
    let access: Access = { source: null, gift: true };
    mockService(() => access);
    post.mockImplementation((url: string) => {
      if (url === giftUrl) {
        access = { source: 'gift' };
        return Promise.resolve({ data: { hasAccess: true, source: 'gift', giftAvailable: false, giftConsumed: true } });
      }
      return Promise.resolve({ data: { url: FORM_URL } });
    });
    renderGuided({ concordatoFacile: true });

    fireEvent.click(await screen.findByTestId('cf-gift-button'));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(FORM_URL));
    expect(linkCalls()).toHaveLength(1);
  });

  it('a link that could not be made says so calmly and «Apri il modulo» asks again, once more', async () => {
    mockService(() => ({ source: 'payment' }));
    post.mockRejectedValueOnce(httpError(500)).mockResolvedValue({ data: { url: FORM_URL } });

    renderGuided({ concordatoFacile: true }, `/app/long-rent/leases/${leaseId}/guided-contract?checkout=success`);

    expect(await screen.findByTestId('cf-open-error')).toHaveTextContent(i18n.t('guidedContract.openError'));
    expect(linkCalls()).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cf-open-form'));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(FORM_URL));
    expect(linkCalls()).toHaveLength(2);
  });

  it('the old address goes on to the new one and keeps the result of the payment', async () => {
    mockService(() => ({ source: null }));

    renderGuided({ concordatoFacile: true }, `/app/long-rent/leases/${leaseId}/concordatofacile?checkout=cancelled`);

    expect(await screen.findByText(i18n.t('concordatofacile.offer.cancelled'))).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('a checkout refused because the contract is already paid reads the access again and sends the person to the sheet, which opens the form', async () => {
    let paid = false;
    mockService(() => ({ source: paid ? 'payment' : null }));
    post.mockImplementation((url: string) => {
      if (url === linkUrl) return Promise.resolve({ data: { url: FORM_URL } });
      paid = true; // the payment is recorded by the time the access is read again
      return Promise.reject(httpError(409, { code: 'concordatofacile_already_purchased' }));
    });
    renderGuided({ concordatoFacile: true });

    fireEvent.click(await screen.findByTestId('cf-pay-button'));

    expect(await screen.findByTestId('lease-sheet-stub')).toBeInTheDocument();
    expect(linkCalls()).toHaveLength(0);
    expect(screen.queryByText(i18n.t('concordatofacile.offer.checkoutError'))).not.toBeInTheDocument();
  });

  it('a checkout refused while the payment is not recorded yet says so quietly and does not offer a second payment as an error', async () => {
    mockService(() => ({ source: null }));
    post.mockRejectedValue(httpError(409, { code: 'concordatofacile_already_purchased' }));
    renderGuided({ concordatoFacile: true });

    // The page of payment says the price, and that registro e bollo, where due, are not in it.
    expect(await screen.findByTestId('cf-offer-taxes')).toHaveTextContent(i18n.t('guidedContract.taxesNote'));
    fireEvent.click(screen.getByTestId('cf-pay-button'));

    expect(await screen.findByTestId('cf-already-purchased')).toHaveTextContent(i18n.t('apiErrors.codes.concordatofacileAlreadyPurchased'));
    expect(screen.queryByText(i18n.t('concordatofacile.offer.checkoutError'))).not.toBeInTheDocument();
  });
});
