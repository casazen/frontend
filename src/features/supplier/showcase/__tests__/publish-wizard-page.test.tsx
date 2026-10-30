import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { starterContentFor } from '@/lib/supplier-site/starter-content';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { listOf, makeService, problem, renderRouted } from '../../services/__tests__/service-test-kit';
import { SupplierShowcasePublishWizardPage } from '../publish-wizard-page';

const api = vi.hoisted(() => ({
  getContent: vi.fn(),
  getStats: vi.fn(),
  publish: vi.fn(),
  undoPublish: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  discard: vi.fn(),
  saveDraft: vi.fn(),
}));
vi.mock('@/api/supplier-showcase.api', () => ({ supplierShowcaseApi: api }));

const servicesApi = vi.hoisted(() => ({ fetchServices: vi.fn() }));
vi.mock('@/api/supplier-services.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/supplier-services.api')>()),
  fetchSupplierServices: servicesApi.fetchServices,
}));

vi.mock('@/queries/supplier/use-profile', () => ({
  useSupplierProfile: () => ({ isLoading: false, isError: false, data: { categories: ['cleaning'], photoUrls: [] } }),
}));
vi.mock('@/queries/use-supplier-settings', () => ({ useSupplierSettings: () => ({ data: { respondWithinMinutes: 180 } }) }));

const PATH = '/app/supplier/showcase/publish';
const starter = starterContentFor(['cleaning'])!;

/** A showcase that was never written and is ready to be published: the server's answer, with the fields the wizard reads. */
function content(patch: Partial<ShowcaseContent> = {}): ShowcaseContent {
  return {
    schemaVersion: 1,
    state: 'Draft',
    version: 0,
    draft: {},
    published: null,
    changes: [],
    savedAt: null,
    publishedAt: null,
    pausedAt: null,
    undoUntil: null,
    readiness: {
      canPublish: true,
      items: [
        { code: 'services', level: 'ok', required: true, target: '/app/supplier/services' },
        { code: 'zones', level: 'ok', required: true, target: '/app/supplier/profile' },
      ],
    },
    bookings: { open: false, blockedBy: ['not_published', 'payments_off'] },
    // No address: the preview is left out, the tests are about the steps.
    publicPath: null,
    publicUrl: null,
    ...patch,
  };
}

function renderWizard(answer: ShowcaseContent, at = PATH) {
  api.getContent.mockResolvedValue(answer);
  api.getStats.mockResolvedValue({ days: 30, requests: 0, pending: 0 });
  return renderRouted({ at, routes: [{ path: PATH, element: <SupplierShowcasePublishWizardPage /> }] });
}

const next = () => fireEvent.click(screen.getByTestId('wizard-next'));

describe('"Crea la tua vetrina": the guided creation (SP-13e)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const fn of Object.values(api)) fn.mockReset();
    servicesApi.fetchServices.mockReset();
    servicesApi.fetchServices.mockResolvedValue(listOf([makeService({ id: 'svc-1', slug: 'cambio-ospiti', name: 'Cambio ospiti' })]));
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('publishes a valid showcase by pressing Continua at every step: the starting text is saved, the version goes on, the confirmation says what happens', async () => {
    api.saveDraft.mockResolvedValue(content({ version: 1, draft: { tagline: starter.tagline, intro: starter.intro } }));
    api.publish.mockResolvedValue(content({ state: 'Online', version: 2, publicPath: '/fornitori/pulizie-roma', bookings: { open: false, blockedBy: ['payments_off'] } }));
    renderWizard(content());

    // 1. Stile: nothing changed from what the page already shows, so nothing is saved.
    await screen.findByRole('heading', { name: 'Scegli lo stile della vetrina' });
    next();

    // 2. Presentazione: the starting text of the trade is there, and is saved with the version the page was opened on.
    expect(await screen.findByLabelText(/Frase in grande/)).toHaveValue(starter.tagline);
    expect(screen.getByTestId('supplier-showcase-wizard-prefilled')).toBeInTheDocument();
    next();
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledWith(0, { tagline: starter.tagline, intro: starter.intro }));
    expect(api.saveDraft).toHaveBeenCalledTimes(1);

    // 3. Servizi: the active service is already chosen; every one chosen in the order of the catalog is nothing to save.
    await screen.findByRole('heading', { name: 'Scegli i servizi da mostrare' });
    next();

    // 4. Riepilogo: the last button publishes, with the version the save answered with.
    await screen.findByRole('heading', { name: 'Controlla e pubblica' });
    fireEvent.click(screen.getByTestId('supplier-showcase-wizard-finish'));
    await waitFor(() => expect(api.publish).toHaveBeenCalledWith(1));
    expect(api.saveDraft).toHaveBeenCalledTimes(1);

    expect(await screen.findByRole('heading', { name: 'La tua vetrina è online' })).toBeInTheDocument();
    // The bookings are closed because the payments are not on: it is said, not hidden.
    expect(screen.getByText(/pagamenti online non sono ancora attivi/i)).toBeInTheDocument();
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', '/fornitori/pulizie-roma');
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/supplier/showcase?condividi=1');
  });

  it('does not go past a sentence of fewer than 12 characters, and says so under the field', async () => {
    renderWizard(content({ draft: { tagline: 'Ciao' } }));

    await screen.findByRole('heading', { name: 'Scegli lo stile della vetrina' });
    next();
    expect(await screen.findByLabelText(/Frase in grande/)).toHaveValue('Ciao');
    next();

    expect(await screen.findByText('Scrivi almeno 12 caratteri.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Presenta la tua attività' })).toBeInTheDocument();
    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('stays on the step and says why when the showcase was changed elsewhere', async () => {
    api.saveDraft.mockRejectedValue(problem(409, { code: 'showcase_version_conflict' }));
    renderWizard(content());

    await screen.findByRole('heading', { name: 'Scegli lo stile della vetrina' });
    next();
    await screen.findByLabelText(/Frase in grande/);
    next();

    expect(await screen.findByTestId('supplier-showcase-wizard-error')).toHaveTextContent('La vetrina è stata modificata altrove');
    expect(screen.getByRole('heading', { name: 'Presenta la tua attività' })).toBeInTheDocument();
  });

  it('says where to make a service when there is none to show, and does not go on', async () => {
    servicesApi.fetchServices.mockResolvedValue(listOf([makeService({ id: 'svc-2', slug: 'ripasso', name: 'Ripasso', status: 'Draft' })]));
    api.saveDraft.mockResolvedValue(content({ version: 1 }));
    renderWizard(content());

    await screen.findByRole('heading', { name: 'Scegli lo stile della vetrina' });
    next();
    await screen.findByLabelText(/Frase in grande/);
    next();

    expect(await screen.findByTestId('supplier-showcase-wizard-no-services')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-next')).toBeDisabled();
  });

  it('leaves a showcase that is already online to the overview', async () => {
    renderWizard(content({ state: 'Online', version: 5 }));
    expect(await screen.findByTestId('elsewhere')).toBeInTheDocument();
  });
});
