import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { toastUndo } from '@/lib/toast-undo';
import type { LeaseDetail, LeaseStage } from '@/types';
import { buildDetail, buildSummary, httpError, renderAt } from '../../__tests__/lease-test-utils';
import { availableLeaseActions } from '../lifecycle-actions';
import { useLeaseActions } from '../use-lease-actions';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/lib/toast-undo', () => ({ toastUndo: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);
const del = vi.mocked(axios.delete);

function Harness({ lease }: { lease: LeaseDetail }) {
  const actions = useLeaseActions(lease, { tenant: 'Giulia Verdi', property: 'Casa Trastevere' });
  return <>{actions.dialogs}</>;
}

const RULES = {
  termMonths: { Libero: 48, Concordato: 36 },
  renewalMonths: { Libero: 48, Concordato: 24 },
  noticeMonths: 6,
  registrationDays: 30,
  depositMaxRents: 3,
  availableTypes: ['Libero', 'Concordato', 'Transitorio'],
  importedTypes: ['Libero', 'Concordato', 'Transitorio'],
  transitoryTermMonths: { min: 1, max: 18 },
  transitoryDocumentationAfterDays: 30,
  transitoryBandFromInhabitants: 10_000,
};

function renderAction(lease: LeaseDetail, action: string, stage?: LeaseStage) {
  get.mockImplementation((url: string) => {
    if (url === '/leases') return Promise.resolve({ data: [buildSummary({ id: lease.id, propertyId: lease.propertyId, stage })] });
    if (url === '/long-rent/rules') return Promise.resolve({ data: RULES });
    return Promise.reject(httpError(404));
  });
  return renderAt(`/app/long-rent/leases/${lease.id}?azione=${action}`, '/app/long-rent/leases/:id', <Harness lease={lease} />);
}

describe('the actions of the life of a lease (LR-10)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('deleteDraft_ConfirmThenAnnulla_NothingIsEverDeleted', async () => {
    renderAction(buildDetail({ id: 'draft-a', status: 'Draft' }), 'elimina-bozza', 'Draft');

    const dialog = await screen.findByRole('dialog');
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina la bozza' }));

    await waitFor(() => expect(toastUndo).toHaveBeenCalledTimes(1));
    expect(del).not.toHaveBeenCalled();

    vi.mocked(toastUndo).mock.calls[0][1].undo();
    expect(del).not.toHaveBeenCalled();
  });

  it('deleteDraft_SixSecondsPass_DeletesTheDraftOnTheServer', async () => {
    del.mockResolvedValue({ data: '' });
    renderAction(buildDetail({ id: 'draft-b', status: 'Draft' }), 'elimina-bozza', 'Draft');

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina la bozza' }));
    await waitFor(() => expect(toastUndo).toHaveBeenCalledTimes(1));
    expect(del).not.toHaveBeenCalled();

    await vi.mocked(toastUndo).mock.calls[0][1].commit?.();

    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('/leases/draft-b', undefined);
  });

  it('terminate_WithoutTheWord_NothingIsSent_WithTheWordAndTheDay_TheLeaseEnds', async () => {
    post.mockResolvedValue({ data: buildDetail({ id: 'lease-t', status: 'Registered', terminatedOn: '2026-10-20T00:00:00Z' }) });
    renderAction(buildDetail({ id: 'lease-t', status: 'Registered' }), 'termina', 'Active');

    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Termina il contratto' });
    const input = within(dialog).getByTestId('confirmation-input');
    fireEvent.change(within(dialog).getByTestId('lease-terminate-date'), { target: { value: '2026-10-20' } });

    expect(confirm).toBeDisabled();
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, { target: { value: 'altro' } });
    fireEvent.submit(input.closest('form')!);
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'termina' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/leases/lease-t/terminate', { on: '2026-10-20' }, undefined);
    expect(toastUndo).not.toHaveBeenCalled();
  });

  it('terminate_ThePickerStartsTheDayAfterTheLeaseBegan_TheDayItBeganOnIsRefused_AndTheFactsAreOneSentence', async () => {
    renderAction(buildDetail({ id: 'lease-m', status: 'Registered' }), 'termina', 'Active');

    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByTestId('lease-terminate-date');
    expect(date).toHaveAttribute('min', '2026-10-02');
    expect(date).toHaveAttribute('max', '2030-09-30');
    expect(await within(dialog).findByTestId('lease-terminate-facts')).toHaveTextContent(
      /6 mesi di preavviso.*entro 30 giorni.*cedolare secca/,
    );

    fireEvent.change(date, { target: { value: '2026-10-01' } });
    fireEvent.change(within(dialog).getByTestId('confirmation-input'), { target: { value: 'termina' } });
    expect(within(dialog).getByRole('button', { name: 'Termina il contratto' })).toBeDisabled();
    expect(within(dialog).getByText(/Scegli un giorno dal 2 ottobre 2026 al 30 settembre 2030/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('terminate_ALeaseThatHasNotBegun_HasNoSuchAction_AndOneThatHasDoes', () => {
    const notBegun = buildDetail({ id: 'lease-n', status: 'Registered', startDate: '2026-11-01T00:00:00Z' });
    const running = buildDetail({ id: 'lease-r', status: 'Registered', startDate: '2026-10-01T00:00:00Z' });
    const context = { stage: 'Active' as const, canManage: true, canChangeMode: false, today: '2026-10-25' };

    expect(availableLeaseActions(notBegun, context).termina).toBe(false);
    expect(availableLeaseActions(running, context).termina).toBe(true);
    expect(availableLeaseActions(notBegun, { ...context, today: '2026-11-01' }).termina).toBe(true);
  });

  it('erasure_OnlyAfterTheConfirmation_AndTheAnswerIsToldInWords', async () => {
    post.mockResolvedValue({ data: { status: 'Scheduled', anonymizationFrom: '2030-10-01T00:00:00Z', partiesKept: 0 } });
    renderAction(buildDetail({ id: 'lease-e', status: 'Registered' }), 'cancellazione-dati');

    const dialog = await screen.findByRole('dialog');
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Chiedi la cancellazione' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/leases/lease-e/erasure-request', undefined, undefined);
    expect(await screen.findByTestId('lease-erasure-result')).toHaveTextContent('anonimizzati dal 1 ottobre 2030');
  });
});
