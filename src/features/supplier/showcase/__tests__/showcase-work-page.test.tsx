import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { starterContentFor } from '@/lib/supplier-site/starter-content';
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
vi.mock('@/queries/supplier/use-profile', () => ({
  useSupplierProfile: () => ({ isLoading: false, data: { categories: ['cleaning'], photoUrls: ['https://cdn.example/profile-1.jpg'] } }),
}));

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

function renderEditor(answer: ShowcaseContent, step: 'style' | 'works' | 'texts' | 'services' | 'publish') {
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

  it('offers a starting text for the trade, fills only the empty fields with it and takes it back with Annulla', async () => {
    const starter = starterContentFor(['cleaning'])!;
    api.saveDraft.mockResolvedValue(content({ version: 4 }));
    renderEditor(content({ draft: { tagline: 'La mia frase' } }), 'texts');

    fireEvent.click(await screen.findByTestId('supplier-showcase-starter'));

    // What the supplier wrote stays; the empty members get the text.
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledWith(3, { intro: starter.intro, prep: starter.prep }), { timeout: 3000 });
    expect(screen.getByLabelText(/Frase in grande/)).toHaveValue('La mia frase');
    expect(screen.getByLabelText(/Introduzione/)).toHaveValue(starter.intro);
    const [message, options] = sonner.toast.success.mock.calls.at(-1) as [string, { action: { label: string; onClick: () => void } }];
    expect(message).toBe('Testo di partenza inserito');
    expect(options.action.label).toBe('Annulla');
    // Nothing is offered once the three are filled.
    expect(screen.queryByTestId('supplier-showcase-starter')).not.toBeInTheDocument();
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

  it('picks the photo of a job among the ones the supplier already has, and sends the gallery with it', async () => {
    servicesApi.fetchServices.mockResolvedValue(listOf([makeService({ photoUrls: ['https://cdn.example/servizio-1.jpg'] })]));
    api.saveDraft.mockResolvedValue(content({ version: 4 }));
    renderEditor(content({ draft: { gallery: [{ photoUrl: '', caption: 'Bagno rifatto' }] } }), 'works');

    fireEvent.click(await screen.findByTestId('supplier-showcase-work-0-pick'));
    const picker = await screen.findByTestId('supplier-showcase-photo-picker');
    // The photos of the profile come first, then the ones of each service.
    await waitFor(() => expect(picker.querySelectorAll('button[aria-pressed]')).toHaveLength(2));
    fireEvent.click(within(picker).getByRole('button', { name: 'Foto 1 del profilo' }));

    await waitFor(
      () => expect(api.saveDraft).toHaveBeenCalledWith(3, { gallery: [{ photoUrl: 'https://cdn.example/profile-1.jpg', caption: 'Bagno rifatto' }] }),
      { timeout: 3000 },
    );
    expect(screen.queryByTestId('supplier-showcase-photo-picker')).not.toBeInTheDocument();
  });

  it('turns the before and after on with no photo yet, and off again by clearing it', async () => {
    servicesApi.fetchServices.mockResolvedValue(listOf([]));
    api.saveDraft.mockResolvedValue(content({ version: 4 }));
    renderEditor(content({ draft: { gallery: [{ photoUrl: 'https://cdn.example/profile-1.jpg', caption: 'Bagno' }] } }), 'works');

    fireEvent.click(await screen.findByRole('switch', { name: 'Mostra il confronto prima e dopo' }));

    await waitFor(
      () => expect(api.saveDraft).toHaveBeenCalledWith(3, { gallery: [{ photoUrl: 'https://cdn.example/profile-1.jpg', caption: 'Bagno', beforeUrl: '' }] }),
      { timeout: 3000 },
    );
    expect(await screen.findByTestId('supplier-showcase-work-0-pick-before')).toBeInTheDocument();
  });

  it('does not offer to publish a job with no photo, and sends the person to the jobs', async () => {
    renderEditor(content({ draft: { gallery: [{ photoUrl: '', caption: 'Senza foto' }] } }), 'publish');

    const check = await screen.findByTestId('supplier-showcase-check-half-filled-works');
    expect(check).toHaveTextContent('Lavoro 1');
    expect(within(check).getByRole('link', { name: /Sistema/ })).toHaveAttribute('href', `${PATH}?step=works`);
    expect(screen.getByTestId('supplier-showcase-publish-button')).toBeDisabled();
  });

  it('does not offer to publish a question with no answer, and says where it is', async () => {
    renderEditor(content({ draft: { faq: [{ q: 'Quanto costa?', a: '' }] } }), 'publish');

    const check = await screen.findByTestId('supplier-showcase-check-half-filled-texts');
    expect(check).toHaveTextContent('Domanda 1');
    expect(within(check).getByRole('link', { name: /Sistema/ })).toHaveAttribute('href', `${PATH}?step=texts`);
    expect(screen.getByTestId('supplier-showcase-publish-button')).toBeDisabled();
  });
});
