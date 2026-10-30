import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { listOf, makeService, problem, renderRouted } from '../../services/__tests__/service-test-kit';
import { SupplierShowcaseHubPage } from '../showcase-hub-page';

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

// The categories of the profile only decide which style is marked as the recommended one.
vi.mock('@/queries/supplier/use-profile', () => ({ useSupplierProfile: () => ({ data: { categories: ['cleaning'] } }) }));

const sonner = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('sonner', () => sonner);

const PATH = '/app/supplier/showcase';

/** A showcase that was never published and is ready to be: the server's answer, with the fields the editor reads. */
function content(patch: Partial<ShowcaseContent> = {}): ShowcaseContent {
  return {
    schemaVersion: 1,
    state: 'Draft',
    version: 3,
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
    bookings: { open: false, blockedBy: ['not_published'] },
    // No address: the preview says why it is not there, and the tests are about the panels and the draft.
    publicPath: null,
    publicUrl: null,
    ...patch,
  };
}

function renderEditor(answer: ShowcaseContent, step: 'style' | 'texts' | 'services' | 'publish') {
  api.getContent.mockResolvedValue(answer);
  api.getStats.mockResolvedValue({ days: 30, requests: 0, pending: 0 });
  return renderRouted({ at: `${PATH}?step=${step}`, routes: [{ path: PATH, element: <SupplierShowcaseHubPage /> }] });
}

const saveStatus = () => screen.getByTestId('supplier-showcase-save').getAttribute('data-status');

describe('The work view of the editor: "Il mio sito vetrina" (SP-13d)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const fn of Object.values(api)) fn.mockReset();
    servicesApi.fetchServices.mockReset();
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('saves what is written after a short pause, once, as a patch with the version it read', async () => {
    api.saveDraft.mockResolvedValue(content({ version: 4, savedAt: '2026-10-30T10:00:00Z', draft: { tagline: 'Casa pronta, senza pensieri' } }));
    renderEditor(content(), 'texts');

    const field = await screen.findByLabelText(/Frase in grande/);
    fireEvent.change(field, { target: { value: 'Casa' } });
    fireEvent.change(field, { target: { value: 'Casa pronta' } });
    fireEvent.change(field, { target: { value: 'Casa pronta, senza pensieri' } });
    expect(saveStatus()).toBe('dirty');
    expect(api.saveDraft).not.toHaveBeenCalled();

    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledWith(3, { tagline: 'Casa pronta, senza pensieri' }), { timeout: 3000 });
    await waitFor(() => expect(saveStatus()).toBe('saved'));
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
  });

  it('says which value the server refused, keeps what was typed and holds the status at "invalid"', async () => {
    api.saveDraft.mockRejectedValue(problem(422, { code: 'showcase_content_invalid', fields: ['tagline'] }));
    renderEditor(content(), 'texts');

    const field = await screen.findByLabelText(/Frase in grande/);
    fireEvent.change(field, { target: { value: 'Una frase che il server rifiuta' } });

    await waitFor(() => expect(saveStatus()).toBe('invalid'), { timeout: 3000 });
    expect(screen.getByText('Questo valore non va bene: controllalo.')).toBeInTheDocument();
    expect(field).toHaveValue('Una frase che il server rifiuta');
  });

  it('asks to reload when the showcase was changed elsewhere, and then shows what the server has', async () => {
    api.saveDraft.mockRejectedValue(problem(409, { code: 'showcase_version_conflict' }));
    renderEditor(content(), 'texts');

    fireEvent.change(await screen.findByLabelText(/Frase in grande/), { target: { value: 'La mia frase' } });

    const dialog = await screen.findByTestId('supplier-showcase-conflict', undefined, { timeout: 3000 });
    expect(dialog).toHaveTextContent('La vetrina è stata modificata altrove');
    api.getContent.mockResolvedValue(content({ version: 9, draft: { tagline: 'Scritta altrove' } }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ricarica' }));

    await waitFor(() => expect(screen.queryByTestId('supplier-showcase-conflict')).not.toBeInTheDocument());
    expect(screen.getByLabelText(/Frase in grande/)).toHaveValue('Scritta altrove');
  });

  it('sends what waits before it publishes, publishes the version the save answered with, and the next save carries the new one', async () => {
    api.saveDraft.mockResolvedValueOnce(content({ version: 4, draft: { tagline: 'Pronti' } }));
    api.publish.mockResolvedValue(content({ state: 'Online', version: 5, draft: { tagline: 'Pronti' } }));
    api.saveDraft.mockResolvedValueOnce(content({ state: 'ChangesReady', version: 6, draft: { tagline: 'Pronti', intro: 'Da noi' } }));
    renderEditor(content(), 'texts');

    fireEvent.change(await screen.findByLabelText(/Frase in grande/), { target: { value: 'Pronti' } });
    // The step is left before the pause is over: what waits is still sent, and before the publication.
    fireEvent.click(screen.getByTestId('supplier-showcase-step-publish'));
    fireEvent.click(await screen.findByTestId('supplier-showcase-publish-button'));

    await waitFor(() => expect(api.publish).toHaveBeenCalledWith(4));
    expect(api.saveDraft).toHaveBeenNthCalledWith(1, 3, { tagline: 'Pronti' });
    await waitFor(() => expect(sonner.toast.success).toHaveBeenCalled());

    // A publication changes the row: the next save names the version the publication answered with, never the one before it.
    fireEvent.click(screen.getByTestId('supplier-showcase-step-texts'));
    fireEvent.change(await screen.findByLabelText(/Introduzione/), { target: { value: 'Da noi' } });
    await waitFor(() => expect(api.saveDraft).toHaveBeenNthCalledWith(2, 5, { intro: 'Da noi' }), { timeout: 3000 });
  });

  it('leaves a service out of the page by naming the others, and keeps the last one on', async () => {
    servicesApi.fetchServices.mockResolvedValue(
      listOf([
        makeService({ id: 'svc-1', slug: 'cambio-ospiti', name: 'Cambio ospiti' }),
        makeService({ id: 'svc-2', slug: 'biancheria', name: 'Biancheria', category: 'laundry' }),
        makeService({ id: 'svc-3', slug: 'ripasso', name: 'Ripasso', status: 'Draft' }),
      ]),
    );
    api.saveDraft.mockResolvedValue(content({ version: 4, draft: { serviceOrder: ['biancheria'] } }));
    renderEditor(content(), 'services');

    fireEvent.click(await screen.findByRole('switch', { name: /Cambio ospiti/ }));

    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledWith(3, { serviceOrder: ['biancheria'] }), { timeout: 3000 });
    // The page cannot show none: the last one is not switched off.
    expect(screen.getByRole('switch', { name: /Biancheria/ })).toBeDisabled();
    // A draft is not offered: it says why and where it is finished.
    expect(screen.getByTestId('supplier-showcase-service-ripasso')).toHaveTextContent('Bozza');
  });

  it('keeps all the sections of the home on unless one is switched off, and sends all of them', async () => {
    servicesApi.fetchServices.mockResolvedValue(listOf([makeService()]));
    api.saveDraft.mockResolvedValue(content({ version: 4 }));
    renderEditor(content(), 'services');

    fireEvent.click(await screen.findByRole('switch', { name: /Come funziona/ }));

    await waitFor(
      () => expect(api.saveDraft).toHaveBeenCalledWith(3, { sections: { trust: true, how: false, works: true, zones: true, certs: true, faq: true } }),
      { timeout: 3000 },
    );
  });

  it('does not offer to publish a question with no answer, and says where it is', async () => {
    renderEditor(content({ draft: { faq: [{ q: 'Quanto costa?', a: '' }] } }), 'publish');

    const check = await screen.findByTestId('supplier-showcase-check-half-filled');
    expect(check).toHaveTextContent('Domanda 1');
    expect(within(check).getByRole('link', { name: /Sistema/ })).toHaveAttribute('href', `${PATH}?step=texts`);
    expect(screen.getByTestId('supplier-showcase-publish-button')).toBeDisabled();
  });
});
