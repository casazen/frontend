import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { PublicSupplierService, SupplierShowcaseDto } from '@/api/public-supplier.api';
import { SupplierSiteShell } from '@/components/supplier-site/supplier-site-shell';
import { LegacySupplierShowcaseRedirect, SupplierShowcasePage } from '../supplier-showcase';

const api = vi.hoisted(() => ({ getShowcase: vi.fn(), quote: vi.fn() }));
vi.mock('@/api/public-supplier.api', () => ({ publicSupplierApi: api }));

// The list of comuni is not what is under test.
vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => ({ data: { datasetAvailable: true }, isPending: false, isError: false }),
  useComuneSearch: () => ({ data: { items: [] }, isFetching: false, isSuccess: true, isError: false }),
}));

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

const SERVICE: PublicSupplierService = {
  slug: 'pulizia-standard',
  name: 'Pulizia standard',
  category: 'cleaning',
  summary: 'Pulizia completa tra un ospite e l’altro.',
  priceFromCents: 4500,
  priceUnit: 'PerJob',
  pricesIncludeVat: true,
  requiresQuote: false,
  durationMinutes: 90,
  included: [],
  excluded: [],
  photoUrls: [],
  urgent: { enabled: false, surchargeCents: 0 },
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
            <Route path="/fornitori/:slug" element={<SupplierSiteShell />}>
              <Route index element={<SupplierShowcasePage />} />
            </Route>
            <Route path="/s/:slug" element={<LegacySupplierShowcaseRedirect />} />
          </Routes>
          <Where />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute('content');

describe('SupplierShowcasePage: public showcase /fornitori/:slug (SU-13, A4-16, SP-09-FE)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('shows the supplier with translated categories, the comuni, the bio, only a displayable photo and the days', async () => {
    api.getShowcase.mockResolvedValue(SHOWCASE);
    renderAt('/fornitori/pulizie-roma');

    expect(await screen.findByTestId('supplier-showcase-name')).toHaveTextContent('Pulizie Roma Srl');
    expect(api.getShowcase).toHaveBeenCalledWith('pulizie-roma');
    // Category codes are translated, never shown raw ("cleaning").
    expect(screen.queryByText('cleaning')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('supplier-site-categories')).getByText('Pulizie')).toBeInTheDocument();
    expect(within(screen.getByTestId('supplier-site-zones')).getByText('Roma')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-site-bio')).toHaveTextContent('Pulizie professionali per affitti brevi.');
    // The cover is the first photo that can be shown; a relative legacy path is not a photo.
    const images = screen.getByTestId('supplier-site-hero').querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', 'https://cdn.example.test/p1.jpg');
    expect(screen.getByText('1 giorno disponibile nelle prossime 2 settimane')).toBeInTheDocument();
  });

  it('is indexable when it shows the supplier', async () => {
    api.getShowcase.mockResolvedValue(SHOWCASE);
    renderAt('/fornitori/pulizie-roma');

    await screen.findByTestId('supplier-showcase-name');
    expect(robots()).not.toBe('noindex,nofollow');
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

  it('shows no block of days when the supplier has not entered availability', async () => {
    api.getShowcase.mockResolvedValue({ ...SHOWCASE, availability: [] });
    renderAt('/fornitori/pulizie-roma');

    await screen.findByTestId('supplier-showcase-name');
    expect(screen.queryByTestId('supplier-site-days')).not.toBeInTheDocument();
  });

  it('moves the old address /s/:slug to /fornitori/:slug', async () => {
    api.getShowcase.mockResolvedValue(SHOWCASE);
    renderAt('/s/pulizie-roma');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/fornitori/pulizie-roma'));
    expect(await screen.findByTestId('supplier-showcase-name')).toBeInTheDocument();
  });

  it('with the bookings open shows the finder, the services with their price and only the trust that is true', async () => {
    api.getShowcase.mockResolvedValue({
      ...SHOWCASE,
      services: [SERVICE],
      bookingsOpen: true,
      paused: false,
      acceptsOnlinePayments: true,
      trust: { verified: true, jobsDone: 12 },
      medianResponseMinutes: 130,
      content: { tagline: 'Case vacanza sempre pronte', color: '#ffee00' },
    });
    renderAt('/fornitori/pulizie-roma');

    expect(await screen.findByTestId('supplier-site-finder')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Case vacanza sempre pronte');
    expect(screen.getByTestId('supplier-site-hero-signal')).toHaveTextContent('Verificato da CasaZen');
    for (const kind of ['verified', 'jobs', 'response', 'payments']) {
      expect(screen.getByTestId(`supplier-site-trust-${kind}`)).toBeInTheDocument();
    }
    const card = screen.getByTestId('supplier-site-service-pulizia-standard');
    expect(card).toHaveTextContent('da');
    expect(card).toHaveTextContent('45');
    expect(card).toHaveTextContent('IVA inclusa');
    // A color white text cannot be read on is not put on the buttons.
    expect(screen.getByTestId('supplier-site').getAttribute('style') ?? '').not.toContain('--vz-cta');
    // The payment is said (and the time to answer is the supplier's setting) only while the bookings are open.
    expect(screen.getByTestId('supplier-site-how')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-site-closing')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-site-stickybar')).toBeInTheDocument();
  });

  it('shows what the supplier wrote, only that, and never a contact', async () => {
    api.getShowcase.mockResolvedValue({
      ...SHOWCASE,
      content: {
        gallery: [
          {
            photoUrl: 'https://cdn.example.test/dopo.jpg',
            beforeUrl: 'https://cdn.example.test/prima.jpg',
            caption: 'Cucina rimessa a nuovo',
            place: 'Trastevere',
          },
          { photoUrl: 'javascript:alert(1)', caption: 'Non si vede' },
        ],
        guarantee: { title: 'Rifacciamo se non va', text: 'Entro sette giorni.' },
        certs: [{ label: 'Abilitazione art. 3', detail: 'Rilasciata nel 2019' }, { label: '   ' }],
        faq: [{ q: 'Portate i prodotti?', a: 'Sì, portiamo tutto.' }, { q: 'Senza risposta', a: '' }],
      },
    });
    renderAt('/fornitori/pulizie-roma');

    const works = await screen.findByTestId('supplier-site-works');
    expect(within(works).getByRole('slider')).toBeInTheDocument();
    expect(within(works).queryByText('Non si vede')).not.toBeInTheDocument();
    const certs = screen.getByTestId('supplier-site-certs');
    expect(certs).toHaveTextContent('Rifacciamo se non va');
    expect(certs).toHaveTextContent('Abilitazione art. 3');
    const faq = screen.getByTestId('supplier-site-faq');
    expect(faq).toHaveTextContent('Portate i prodotti?');
    expect(faq).not.toHaveTextContent('Senza risposta');
    // No contact, no rating, no insurance: nothing of the kind is on the page (D11, D13, VT-D14).
    const page = screen.getByTestId('supplier-site').textContent ?? '';
    expect(page).not.toMatch(/tel:|mailto:|whatsapp|assicurat|recension|P\.?\s?IVA/i);
  });

  it('with the bookings closed has no finder and says so, and a service without the VAT declaration says nothing of it', async () => {
    api.getShowcase.mockResolvedValue({
      ...SHOWCASE,
      services: [{ ...SERVICE, pricesIncludeVat: false }],
      bookingsOpen: false,
      paused: false,
      content: { color: '#7c3aed' },
    });
    renderAt('/fornitori/pulizie-roma');

    expect(await screen.findByTestId('supplier-site-bookings-closed')).toBeInTheDocument();
    expect(screen.queryByTestId('supplier-site-finder')).not.toBeInTheDocument();
    expect(screen.getByTestId('supplier-site-service-pulizia-standard')).not.toHaveTextContent('IVA inclusa');
    // A color that reads at AA is the one of the buttons.
    expect(screen.getByTestId('supplier-site').getAttribute('style') ?? '').toContain('#7c3aed');
  });

  it('says a paused showcase takes no bookings and shows no finder', async () => {
    api.getShowcase.mockResolvedValue({ ...SHOWCASE, services: [SERVICE], bookingsOpen: false, paused: true, content: {} });
    renderAt('/fornitori/pulizie-roma');

    expect(await screen.findByTestId('supplier-showcase-paused')).toHaveTextContent('Pulizie Roma Srl non accetta prenotazioni per ora');
    expect(screen.queryByTestId('supplier-site-finder')).not.toBeInTheDocument();
  });
});
