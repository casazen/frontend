import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierShowcasePreview } from '@/types/supplier';
import { SupplierShowcasePreviewPage } from '../supplier-showcase-preview-page';

const api = vi.hoisted(() => ({ fetchSupplierShowcasePreview: vi.fn() }));
vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PUBLISHED: SupplierShowcasePreview = {
  showcase: {
    slug: 'pulizie-roma',
    legalName: 'Pulizie Roma Srl',
    categories: ['cleaning'],
    comuni: ['Roma'],
    bio: 'Pulizie professionali.',
    photoUrls: [],
    availability: [],
  },
  status: 'Active',
  published: true,
  slug: 'pulizie-roma',
  publicPath: '/fornitori/pulizie-roma',
  publicUrl: 'https://app.example.test/fornitori/pulizie-roma',
  indexable: false,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SupplierShowcasePreviewPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('SupplierShowcasePreviewPage (SU-13)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    api.fetchSupplierShowcasePreview.mockResolvedValue(PUBLISHED);
  });

  it('shows the same showcase and the address built by the API, with a link that opens the public page', async () => {
    renderPage();

    expect(await screen.findByTestId('supplier-showcase-name')).toHaveTextContent('Pulizie Roma Srl');
    // The base URL is what the API configured: nothing is written in the page.
    expect(screen.getByTestId('supplier-showcase-url')).toHaveTextContent('https://app.example.test/fornitori/pulizie-roma');
    const open = screen.getByTestId('supplier-showcase-open');
    expect(open).toHaveAttribute('href', '/fornitori/pulizie-roma');
    expect(open).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/non compare nei motori di ricerca/)).toBeInTheDocument();
  });

  it('copies the public link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Copia il link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://app.example.test/fornitori/pulizie-roma'));
  });

  it('says the showcase is not public yet for a supplier that was never activated, with the way to activate', async () => {
    api.fetchSupplierShowcasePreview.mockResolvedValue({
      ...PUBLISHED,
      status: 'Pending',
      published: false,
      slug: null,
      publicPath: null,
      publicUrl: null,
    });
    renderPage();

    expect(await screen.findByTestId('supplier-showcase-unpublished')).toHaveTextContent('non è ancora pubblica');
    expect(screen.queryByTestId('supplier-showcase-url')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /attivazione/i })).toHaveAttribute('href', '/app/supplier/activation');
  });

  it('says a suspended supplier is not visible', async () => {
    api.fetchSupplierShowcasePreview.mockResolvedValue({ ...PUBLISHED, status: 'Suspended', published: false, publicUrl: null });
    renderPage();

    expect(await screen.findByTestId('supplier-showcase-unpublished')).toHaveTextContent('sospeso');
    expect(screen.queryByRole('link', { name: /attivazione/i })).not.toBeInTheDocument();
  });

  it('says the public address is not configured instead of showing a wrong link', async () => {
    api.fetchSupplierShowcasePreview.mockResolvedValue({ ...PUBLISHED, publicUrl: null });
    renderPage();

    expect(await screen.findByTestId('supplier-showcase-no-base-url')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copia il link' })).not.toBeInTheDocument();
  });

  it('shows an error with a retry when the preview cannot be loaded', async () => {
    api.fetchSupplierShowcasePreview.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('supplier-showcase-preview-error')).toHaveTextContent(
      "Impossibile caricare l'anteprima della vetrina.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('supplier-showcase-name')).toBeInTheDocument();
  });
});
