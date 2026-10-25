import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { ConcordatoFacileOfferPage } from '../concordatofacile-offer-page';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: undefined }) }));

const leaseId = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

function httpError(status: number, data: object = {}): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', headers: {}, config, data: { status, ...data } });
}

function renderOffer(flags: Partial<FeatureFlags>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value = { flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false };
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        FeatureFlagsContext.Provider,
        { value },
        createElement(
          MemoryRouter,
          { initialEntries: [`/app/long-rent/leases/${leaseId}/concordatofacile`] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/app/long-rent/leases/:id/concordatofacile', element: createElement(ConcordatoFacileOfferPage) }),
            createElement(Route, { path: '/app/long-rent/leases/:id', element: createElement('div', { 'data-testid': 'lease-sheet-stub' }) }),
          ),
        ),
      ),
    ),
  );
}

/** The lease, the access (active only once `paid` is true) and the status of the practices; anything else is a 404. */
function mockService(paid: () => boolean) {
  get.mockImplementation((url: string) => {
    if (url === `/leases/${leaseId}`) {
      return Promise.resolve({ data: { id: leaseId, propertyId: 'property-1', property: { id: 'property-1', name: 'Casa Trastevere', city: 'Roma' }, status: 'Draft' } });
    }
    if (url === `/leases/${leaseId}/concordatofacile/access`) {
      return Promise.resolve({ data: { hasAccess: paid(), source: paid() ? 'payment' : null, giftAvailable: false, giftConsumed: false } });
    }
    if (url === `/leases/${leaseId}/concordatofacile/status`) {
      return Promise.resolve({ data: { practices: [], lastCheckedAt: '2020-01-01T00:00:00Z', nextUpdateAt: '2020-01-01T00:15:00Z', stale: false } });
    }
    return Promise.reject(httpError(404));
  });
}

describe('ConcordatoFacileOfferPage (CF-FIX)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('with the service off the address goes back to the contract and nothing asks the service', async () => {
    renderOffer({ concordatoFacile: false });

    expect(await screen.findByTestId('lease-sheet-stub')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('a checkout refused because the contract is already paid reads the access again and shows it active, not an error', async () => {
    let paid = false;
    mockService(() => paid);
    post.mockImplementation(() => {
      paid = true; // the payment is recorded by the time the access is read again
      return Promise.reject(httpError(409, { code: 'concordatofacile_already_purchased' }));
    });
    renderOffer({ concordatoFacile: true });

    fireEvent.click(await screen.findByTestId('cf-pay-button'));

    expect(await screen.findByTestId('cf-already-purchased-active')).toHaveTextContent(i18n.t('concordatofacile.offer.hasAccess'));
    expect(screen.getByTestId('cf-entry-button')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('concordatofacile.offer.checkoutError'))).not.toBeInTheDocument();
  });

  it('a checkout refused while the payment is not recorded yet says so quietly and does not offer a second payment as an error', async () => {
    mockService(() => false);
    post.mockRejectedValue(httpError(409, { code: 'concordatofacile_already_purchased' }));
    renderOffer({ concordatoFacile: true });

    fireEvent.click(await screen.findByTestId('cf-pay-button'));

    expect(await screen.findByTestId('cf-already-purchased')).toHaveTextContent(i18n.t('apiErrors.codes.concordatofacileAlreadyPurchased'));
    expect(screen.queryByText(i18n.t('concordatofacile.offer.checkoutError'))).not.toBeInTheDocument();
  });
});
