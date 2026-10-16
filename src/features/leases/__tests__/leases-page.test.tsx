import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { LeasesPage } from '../leases-page';
import { buildSummary, HTML_FALLBACK, httpError, renderAt } from './lease-test-utils';

// The real leasesApi and ApiClient run: only the HTTP layer is replaced.
// The first-steps guide has its own tests and reads other endpoints.
vi.mock('@/features/onboarding/components/long-rent-guide', () => ({ LongRentGuide: () => null }));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => ({ userId: 'auth0|tester', context: 'long-rent' }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(axios.get);

function renderPage() {
  return renderAt('/app/long-rent/leases', '/app/long-rent/leases', createElement(LeasesPage));
}

/** The table of the page, once it is there (the cards of a phone are in the page too: a media query shows one of the two). */
const findTable = (name = 'Contratti') => screen.findByRole('table', { name });

describe('LeasesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    await i18n.changeLanguage('it');
  });

  it('render_RealisticLeases_ShowsTenantPropertyStatusRentAndWhatIsLate', async () => {
    get.mockResolvedValue({
      data: [
        buildSummary({ tenantFirstName: 'Giulia', tenantLastName: 'Verdi', overdueRentCount: 1, overdueRentAmount: 950, overdueDays: 6 }),
        buildSummary({
          id: 'lease-2',
          property: null,
          propertyId: 'abcdef12-0000-0000-0000-000000000000',
          status: 'PartiallySigned',
          fiscalRegime: 'CanoneConcordato',
          contractType: 'Concordato',
          taxRegime: null,
        }),
      ],
    });

    renderPage();

    const table = within(await findTable());
    expect(table.getByRole('rowheader', { name: /Giulia Verdi/ })).toBeInTheDocument();
    expect(table.getByText(/Casa Trastevere/)).toBeInTheDocument();
    // Every real status has a label: never the raw key "leases.statusLabel.SentToProvider" (A7-15).
    expect(table.getByText('Inviato al provider')).toBeInTheDocument();
    expect(table.getAllByText(/950,00\s€\/mese/)).toHaveLength(2);
    expect(table.getByText(/In ritardo da 6 giorni/)).toBeInTheDocument();
    // A lease with no tenant yet and no property that can be read says so, never an id.
    expect(table.getByText('Conduttore da indicare')).toBeInTheDocument();
    expect(table.getByText('Immobile non disponibile')).toBeInTheDocument();
    expect(table.getByText('Firmato parzialmente')).toBeInTheDocument();
    expect(screen.queryByText(/leases\.statusLabel/)).not.toBeInTheDocument();
    // The plain list asks for no view and no search: it is the same request the guide makes.
    expect(get).toHaveBeenCalledWith('/leases', expect.objectContaining({ params: undefined }));
  });

  it('render_EnglishUi_ShowsEnglishStatusAndMonthlySuffix', async () => {
    await i18n.changeLanguage('en');
    get.mockResolvedValue({ data: [buildSummary({ status: 'RegistrationPending' })] });

    renderPage();

    const table = within(await findTable('Leases'));
    expect(table.getByText('Registration pending')).toBeInTheDocument();
    expect(table.getByText(/\/mo$/)).toBeInTheDocument();
  });

  it('render_NoLeases_ShowsEmptyStateWithCreateAction', async () => {
    get.mockResolvedValue({ data: [] });

    renderPage();

    expect(await screen.findByText('Nessun contratto')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuovo contratto' })).toHaveAttribute('href', '/app/long-rent/leases/new');
    const guide = screen.getByTestId('long-rent-start-guide');
    expect(within(guide).getByRole('link', { name: 'Aggiungi l\'immobile' })).toHaveAttribute(
      'href',
      '/app/long-rent/properties/new',
    );
    expect(within(guide).getByRole('link', { name: 'Vai agli immobili' })).toHaveAttribute(
      'href',
      '/app/long-rent/properties',
    );
    expect(within(guide).getByRole('link', { name: 'Crea il contratto' })).toHaveAttribute(
      'href',
      '/app/long-rent/leases/new',
    );
  });

  it('render_HtmlFallbackBody_ShowsLoadErrorInsteadOfCrashing', async () => {
    // Regression: `/api/leases` answered by the SPA index.html crashed the page with
    // "items.map is not a function" (E2E L2 Vetrina AC12 redirected here).
    get.mockResolvedValue({ data: HTML_FALLBACK });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Impossibile caricare i contratti. Riprova.')).toBeInTheDocument();
    expect(screen.queryByText('Nessun contratto')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('render_ServerError_ShowsErrorNotEmptyState_AndRetryLoadsTheList', async () => {
    get.mockRejectedValueOnce(httpError(500, { code: 'internal_error', detail: 'NullReferenceException at ...' }));
    get.mockResolvedValueOnce({ data: [buildSummary()] });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Impossibile caricare i contratti. Riprova.')).toBeInTheDocument();
    expect(screen.queryByText(/NullReferenceException/)).not.toBeInTheDocument();
    expect(screen.queryByText('Nessun contratto')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));

    expect(await findTable()).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('render_NetworkError_ShowsTheNetworkMessage', async () => {
    get.mockRejectedValue(httpError());

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(i18n.t('apiErrors.network'))).toBeInTheDocument();
    expect(screen.queryByText('Nessun contratto')).not.toBeInTheDocument();
  });

  it('render_Forbidden_ShowsThePermissionMessage', async () => {
    get.mockRejectedValue(httpError(403, { code: 'forbidden' }));

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(i18n.t('apiErrors.forbidden'))).toBeInTheDocument();
  });
});
