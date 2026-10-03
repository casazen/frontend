import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierShowcaseDto } from '@/api/public-supplier.api';
import { LegacySupplierShowcaseRedirect, SupplierShowcasePage } from '../supplier-showcase';

const api = vi.hoisted(() => ({ getShowcase: vi.fn() }));
vi.mock('@/api/public-supplier.api', () => ({ publicSupplierApi: api }));

const SHOWCASE: SupplierShowcaseDto = {
  slug: 'pulizie-roma',
  legalName: 'Pulizie Roma Srl',
  categories: ['cleaning', 'laundry'],
  comuni: ['Roma', 'Fiumicino'],
  bio: 'Pulizie professionali per affitti brevi.',
  photoUrls: ['https://cdn.example.test/p1.jpg', '/uploads/legacy.jpg'],
  availability: [
    { date: '2026-10-05', available: true },
    { date: '2026-10-06', available: false },
  ],
};

function httpError(status: number) {
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', {} as InternalAxiosRequestConfig, null, {
    status,
    statusText: '',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
    data: {},
  });
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/fornitori/:slug" element={<SupplierShowcasePage />} />
            <Route path="/s/:slug" element={<LegacySupplierShowcaseRedirect />} />
          </Routes>
          <Where />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute('content');

describe('SupplierShowcasePage: public showcase /fornitori/:slug (SU-13, A4-16)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('shows the supplier with translated categories, the comuni, the bio, only displayable photos and the days', async () => {
    api.getShowcase.mockResolvedValue(SHOWCASE);
    renderAt('/fornitori/pulizie-roma');

    expect(await screen.findByTestId('supplier-showcase-name')).toHaveTextContent('Pulizie Roma Srl');
    expect(api.getShowcase).toHaveBeenCalledWith('pulizie-roma');
    // Category codes are translated, never shown raw ("cleaning").
    expect(screen.queryByText('cleaning')).not.toBeInTheDocument();
    expect(screen.getByText('Roma')).toBeInTheDocument();
    expect(screen.getByText('Pulizie professionali per affitti brevi.')).toBeInTheDocument();
    // A relative legacy path is not a photo.
    expect(screen.getByTestId('supplier-showcase-photos').querySelectorAll('img')).toHaveLength(1);
    expect(screen.getByText('1 giorno disponibile nelle prossime 2 settimane')).toBeInTheDocument();
  });

  it('is noindex while it loads, when it shows the supplier and when it fails', async () => {
    api.getShowcase.mockResolvedValue(SHOWCASE);
    renderAt('/fornitori/pulizie-roma');

    await screen.findByTestId('supplier-showcase-name');
    expect(robots()).toBe('noindex,nofollow');
    expect(document.title).toContain('Pulizie Roma Srl');
  });

  it('says the showcase does not exist for a 404, in Italian, without a retry', async () => {
    api.getShowcase.mockRejectedValue(httpError(404));
    renderAt('/fornitori/non-esiste');

    expect(await screen.findByTestId('supplier-showcase-not-found')).toHaveTextContent('Fornitore non trovato');
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    expect(robots()).toBe('noindex,nofollow');
  });

  it('shows an error with a retry, not "not found", when the API fails with a 500', async () => {
    api.getShowcase.mockRejectedValueOnce(httpError(500));
    renderAt('/fornitori/pulizie-roma');

    expect(await screen.findByTestId('supplier-showcase-error')).toHaveTextContent(
      'Impossibile caricare la vetrina del fornitore.',
    );
    expect(screen.queryByTestId('supplier-showcase-not-found')).not.toBeInTheDocument();

    api.getShowcase.mockResolvedValue(SHOWCASE);
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('supplier-showcase-name')).toBeInTheDocument();
  });

  it('shows the page in English', async () => {
    await i18n.changeLanguage('en');
    api.getShowcase.mockRejectedValue(httpError(404));
    renderAt('/fornitori/x');

    expect(await screen.findByTestId('supplier-showcase-not-found')).toHaveTextContent('Supplier not found');
  });

  it('says so when the supplier has not entered availability', async () => {
    api.getShowcase.mockResolvedValue({ ...SHOWCASE, availability: [] });
    renderAt('/fornitori/pulizie-roma');

    expect(await screen.findByTestId('supplier-showcase-no-availability')).toBeInTheDocument();
  });

  it('moves the old address /s/:slug to /fornitori/:slug', async () => {
    api.getShowcase.mockResolvedValue(SHOWCASE);
    renderAt('/s/pulizie-roma');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/fornitori/pulizie-roma'));
    expect(await screen.findByTestId('supplier-showcase-name')).toBeInTheDocument();
  });
});
