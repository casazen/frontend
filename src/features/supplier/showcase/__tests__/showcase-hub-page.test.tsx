import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { renderRouted } from '../../services/__tests__/service-test-kit';
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

const sonner = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('sonner', () => sonner);

const PATH = '/app/supplier/showcase';

/** A showcase that was never published and is ready to be: the server's answer, with the fields the page reads. */
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
    publicPath: '/fornitori/pulizie-roma',
    publicUrl: 'https://app.example.test/fornitori/pulizie-roma',
    ...patch,
  };
}

function renderPage(answer: ShowcaseContent) {
  api.getContent.mockResolvedValue(answer);
  api.getStats.mockResolvedValue({ days: 30, requests: 4, pending: 1 });
  return renderRouted({ at: PATH, routes: [{ path: PATH, element: <SupplierShowcaseHubPage /> }] });
}

/** What the toast of an action that can be undone offers: the word "Annulla" and what it does. */
function undoOf(toastFn: ReturnType<typeof vi.fn>): { message: string; run: () => void } {
  const [message, options] = toastFn.mock.calls.at(-1) as [string, { action: { label: string; onClick: () => void } }];
  expect(options.action.label).toBe('Annulla');
  return { message, run: options.action.onClick };
}

describe('SupplierShowcaseHubPage: "Il mio sito vetrina" (SP-13c)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const fn of Object.values(api)) fn.mockReset();
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('asks to publish a showcase that is ready, with the version it read, and the Annulla really undoes it', async () => {
    renderPage(content());
    api.publish.mockResolvedValue(
      content({ state: 'Online', version: 4, publishedAt: '2026-10-30T10:00:00Z', bookings: { open: false, blockedBy: ['payments_account_not_ready'] } }),
    );
    api.undoPublish.mockResolvedValue(content());

    const focus = await screen.findByTestId('supplier-showcase-focus');
    expect(focus).toHaveTextContent('Pubblica la tua vetrina');
    fireEvent.click(within(focus).getByRole('button', { name: 'Pubblica la vetrina' }));

    await waitFor(() => expect(api.publish).toHaveBeenCalledWith(3));
    await waitFor(() => expect(sonner.toast.success).toHaveBeenCalled());
    const undo = undoOf(sonner.toast.success);
    expect(undo.message).toBe('Vetrina pubblicata');
    expect(api.undoPublish).not.toHaveBeenCalled();
    undo.run();
    await waitFor(() => expect(api.undoPublish).toHaveBeenCalledTimes(1));
  });

  it('says what is missing and leads to the page where it is fixed, instead of offering to publish', async () => {
    renderPage(
      content({
        readiness: {
          canPublish: false,
          items: [
            { code: 'services', level: 'todo', required: true, target: '/app/supplier/services' },
            { code: 'zones', level: 'ok', required: true, target: '/app/supplier/profile' },
          ],
        },
      }),
    );

    const focus = await screen.findByTestId('supplier-showcase-focus');
    expect(focus).toHaveTextContent('Manca ancora qualcosa per pubblicare');
    expect(within(focus).queryByRole('button', { name: 'Pubblica la vetrina' })).not.toBeInTheDocument();
    expect(within(focus).getByRole('link', { name: 'Sistema: Almeno un servizio attivo con un prezzo' })).toHaveAttribute('href', '/app/supplier/services');
    expect(screen.getByTestId('supplier-showcase-todo-services')).toBeInTheDocument();
  });

  it('offers to turn a paused showcase back on, and the Annulla pauses it again', async () => {
    renderPage(content({ state: 'Paused', pausedAt: '2026-10-29T10:00:00Z', publishedAt: '2026-10-20T10:00:00Z' }));
    api.resume.mockResolvedValue(content({ state: 'Online', publishedAt: '2026-10-20T10:00:00Z' }));
    api.pause.mockResolvedValue(content({ state: 'Paused' }));

    const focus = await screen.findByTestId('supplier-showcase-focus');
    expect(focus).toHaveTextContent('La vetrina è in pausa');
    fireEvent.click(within(focus).getByRole('button', { name: 'Riattiva la vetrina' }));

    await waitFor(() => expect(api.resume).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sonner.toast.success).toHaveBeenCalled());
    undoOf(sonner.toast.success).run();
    await waitFor(() => expect(api.pause).toHaveBeenCalledTimes(1));
  });

  it('throws the changes away only after saying what it does, with the version it read', async () => {
    renderPage(
      content({
        state: 'ChangesReady',
        changes: ['tagline', 'faq'],
        publishedAt: '2026-10-20T10:00:00Z',
        bookings: { open: true, blockedBy: [] },
      }),
    );
    api.discard.mockResolvedValue(content({ state: 'Online', changes: [] }));

    fireEvent.click(await screen.findByTestId('supplier-showcase-discard'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Le modifiche non pubblicate andranno perse.');
    expect(dialog).toHaveTextContent('La vetrina che i clienti vedono non cambia.');
    expect(api.discard).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla le modifiche' }));

    await waitFor(() => expect(api.discard).toHaveBeenCalledWith(3));
  });
});
