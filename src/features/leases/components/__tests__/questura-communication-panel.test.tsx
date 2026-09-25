import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { formatDate } from '@/lib/utils';
import { QUESTURA_OFFICIAL_INFO_URL } from '@/lib/questura-communication';
import { QuesturaCommunicationPanel } from '../questura-communication-panel';
import { httpError } from '../../__tests__/lease-test-utils';
import type { QuesturaCommunicationStatus, RliChecklist } from '@/types';

// LT-07 (A7-08): the Questura communication of an extra-EU tenant. The state comes from the API (48 hours from the
// delivery, the start date by default); it is done only after the landlord's declaration, never after a reminder.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Checkbox measures itself with ResizeObserver, which jsdom does not provide.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);
const put = vi.mocked(axios.put);

const TODAY = '2026-09-24';
const CHECKLIST_URL = '/leases/lease-1/rli/checklist';

function questura(overrides: Partial<QuesturaCommunicationStatus> = {}): QuesturaCommunicationStatus {
  return {
    deliveryDate: '2026-09-23T00:00:00Z',
    deliveryDateDeclared: false,
    deadline: '2026-09-25T00:00:00Z',
    daysRemaining: 1,
    communicationDate: null,
    hasReceipt: false,
    ...overrides,
  };
}

function checklist(block: QuesturaCommunicationStatus | null): RliChecklist {
  return {
    registrationDeadline: '2026-10-23T00:00:00Z',
    daysRemaining: 29,
    tosVersion: 'v',
    attestationText: 'a',
    providerFilingAvailable: false,
    items: [{ key: 'questura_extra_eu', label: 'x', done: block?.communicationDate != null }],
    questura: block,
  };
}

function mockChecklist(block: () => QuesturaCommunicationStatus | null) {
  get.mockImplementation((url: string) =>
    url === CHECKLIST_URL ? Promise.resolve({ data: checklist(block()) }) : Promise.reject(httpError(404)),
  );
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <QuesturaCommunicationPanel leaseId="lease-1" leaseEndDate="2030-09-22T00:00:00Z" />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function pdf(name = 'ricevuta-pec.pdf', type = 'application/pdf') {
  return new File(['%PDF-1.4 ricevuta'], name, { type });
}

async function openDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Segna come comunicata' }));
  return within(await screen.findByTestId('questura-mark-done-dialog'));
}

describe('QuesturaCommunicationPanel (LT-07)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T08:00:00Z`));
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it('render_NotDeclared_ShowsDeadlineDefaultDeliveryInstructionsAndOfficialLink', async () => {
    mockChecklist(() => questura());

    renderPanel();

    const state = await screen.findByTestId('questura-state');
    expect(state).toHaveAttribute('data-state', 'todo');
    expect(state).toHaveTextContent(`Da fare entro il ${formatDate('2026-09-25')} (48 ore dalla consegna dell'immobile)`);
    expect(screen.getByTestId('questura-delivery-date')).toHaveTextContent(formatDate('2026-09-23'));
    expect(screen.getByText(/È la data di inizio del contratto/)).toBeInTheDocument();
    const instructions = screen.getByTestId('questura-instructions');
    expect(instructions).toHaveTextContent('art. 7 D.Lgs. 286/1998');
    expect(instructions).toHaveTextContent('CasaZen non invia la comunicazione.');
    expect(instructions).toHaveTextContent('da 160 a 1.100 €');
    expect(within(instructions).getByRole('link')).toHaveAttribute('href', QUESTURA_OFFICIAL_INFO_URL);
    expect(screen.getByRole('button', { name: 'Segna come comunicata' })).toBeInTheDocument();
    expect(screen.queryByText(/Comunicazione dichiarata/)).not.toBeInTheDocument();
  });

  it('render_DeadlineToday_And_Overdue_ShowUrgentStates', async () => {
    mockChecklist(() => questura({ daysRemaining: -2 }));

    renderPanel();

    const state = await screen.findByTestId('questura-state');
    expect(state).toHaveAttribute('data-state', 'overdue');
    expect(state).toHaveTextContent('Termine scaduto');
    cleanup();

    mockChecklist(() => questura({ daysRemaining: 0 }));
    renderPanel();
    expect(await screen.findByTestId('questura-state')).toHaveAttribute('data-state', 'dueToday');
  });

  it('render_Declared_ShowsDateAndReceiptDownloadWithoutMarkButton', async () => {
    mockChecklist(() => questura({ communicationDate: '2026-09-24T00:00:00Z', hasReceipt: true }));

    renderPanel();

    const state = await screen.findByTestId('questura-state');
    expect(state).toHaveAttribute('data-state', 'done');
    expect(state).toHaveTextContent(`inviata il ${formatDate('2026-09-24')}`);
    expect(screen.getByRole('button', { name: 'Scarica ricevuta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Segna come comunicata' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifica data di consegna' })).not.toBeInTheDocument();
  });

  it('render_NoQuesturaBlock_RendersNothing', async () => {
    mockChecklist(() => null);

    const { container } = renderPanel();

    await waitFor(() => expect(get).toHaveBeenCalledWith(CHECKLIST_URL, expect.anything()));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('render_LoadError_ShowsAnErrorNotAnEmptyPanel', async () => {
    get.mockRejectedValue(httpError(500));

    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Impossibile caricare lo stato della comunicazione alla Questura.",
    );
    expect(screen.queryByRole('button', { name: 'Segna come comunicata' })).not.toBeInTheDocument();
  });

  it('markDone_DateReceiptAndConfirmation_PostsMultipartAndShowsItDone', async () => {
    let block = questura();
    mockChecklist(() => block);
    post.mockImplementation(async () => {
      block = questura({ communicationDate: '2026-09-23T00:00:00Z', hasReceipt: true });
      return { data: checklist(block) };
    });

    renderPanel();
    const dialog = await openDialog();
    const submit = dialog.getByRole('button', { name: 'Conferma' });
    expect(submit).toBeDisabled();

    fireEvent.change(dialog.getByLabelText('Data di invio'), { target: { value: '2026-09-23' } });
    fireEvent.change(dialog.getByLabelText('Ricevuta (PDF, facoltativa)'), { target: { files: [pdf()] } });
    expect(submit).toBeDisabled();
    fireEvent.click(dialog.getByRole('checkbox'));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0] as [string, FormData];
    expect(url).toBe('/leases/lease-1/rli/questura/mark-done');
    expect(body.get('communicationDate')).toBe('2026-09-23');
    expect((body.get('receipt') as File).name).toBe('ricevuta-pec.pdf');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Comunicazione alla Questura segnata come inviata'));
    await waitFor(() => expect(screen.getByTestId('questura-state')).toHaveAttribute('data-state', 'done'));
  });

  it('markDone_WithoutReceipt_SendsOnlyTheDate', async () => {
    mockChecklist(() => questura());
    post.mockResolvedValue({ data: checklist(questura({ communicationDate: `${TODAY}T00:00:00Z` })) });

    renderPanel();
    const dialog = await openDialog();
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Conferma' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const body = post.mock.calls[0][1] as FormData;
    expect(body.get('communicationDate')).toBe(TODAY);
    expect(body.has('receipt')).toBe(false);
  });

  it('markDone_FutureDateOrReceiptNotAPdf_CannotSubmit', async () => {
    mockChecklist(() => questura());

    renderPanel();
    const dialog = await openDialog();
    fireEvent.change(dialog.getByLabelText('Data di invio'), { target: { value: '2026-09-25' } });
    fireEvent.change(dialog.getByLabelText('Ricevuta (PDF, facoltativa)'), {
      target: { files: [pdf('ricevuta.png', 'image/png')] },
    });
    fireEvent.click(dialog.getByRole('checkbox'));

    expect(dialog.getByText(/La data non può essere successiva a oggi/)).toBeInTheDocument();
    expect(dialog.getByText('La ricevuta deve essere un file PDF di al massimo 10 MB.')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Conferma' })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('markDone_ServerRefuses_ShowsTheProblemMessageAndKeepsTheDialog', async () => {
    mockChecklist(() => questura());
    post.mockRejectedValue(httpError(409, { code: 'questura_already_marked_done' }));

    renderPanel();
    const dialog = await openDialog();
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Conferma' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('La comunicazione alla Questura di questo contratto risulta già dichiarata.'),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('questura-mark-done-dialog')).toBeInTheDocument();
  });

  it('deliveryDate_ChangedOrReset_PutsTheDateOrNull', async () => {
    let block = questura();
    mockChecklist(() => block);
    put.mockImplementation(async (_url: string, data?: unknown) => {
      const { deliveryDate } = data as { deliveryDate: string | null };
      block = deliveryDate
        ? questura({ deliveryDate: `${deliveryDate}T00:00:00Z`, deliveryDateDeclared: true, deadline: '2026-09-30T00:00:00Z', daysRemaining: 6 })
        : questura();
      return { data: checklist(block) };
    });

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica data di consegna' }));
    fireEvent.change(screen.getByLabelText("Data di consegna dell'immobile"), { target: { value: '2026-09-28' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva data di consegna' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/leases/lease-1/rli/questura/delivery-date', { deliveryDate: '2026-09-28' }, undefined),
    );
    await waitFor(() => expect(screen.getByTestId('questura-delivery-date')).toHaveTextContent(formatDate('2026-09-28')));
    expect(screen.queryByText(/È la data di inizio del contratto/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Modifica data di consegna' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usa la data di inizio del contratto' }));
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith('/leases/lease-1/rli/questura/delivery-date', { deliveryDate: null }, undefined),
    );
  });

  it('deliveryDate_AfterTheEndOfTheLease_CannotSave', async () => {
    mockChecklist(() => questura());

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica data di consegna' }));
    fireEvent.change(screen.getByLabelText("Data di consegna dell'immobile"), { target: { value: '2031-01-01' } });

    expect(screen.getByRole('alert')).toHaveTextContent('non successiva alla fine del contratto');
    expect(screen.getByRole('button', { name: 'Salva data di consegna' })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });
});
