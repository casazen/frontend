import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { toastUndo } from '@/lib/toast-undo';
import type { LeaseDetail, LeaseStage } from '@/types';
import { buildDetail, buildSummary, httpError, renderAt } from '../../__tests__/lease-test-utils';
import { useLeaseActions } from '../use-lease-actions';

// LR-10: the three things on the sheet of a lease that cannot be taken back, each with the rule that keeps a mistake from costing data:
// a draft is deleted only when the six seconds of «Annulla» have passed, a lease is ended only with the word «TERMINA», and the data of
// its people are erased only after the confirmation. Real calls to the API client; the toast of «Annulla» is mocked, its `commit` is
// what runs when the seconds pass and its `undo` is the click on «Annulla».
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

/** The sheet's windows, opened as a link opens them (`?azione=`); the list of the leases of the property tells the stage. */
function renderAction(lease: LeaseDetail, action: string, stage?: LeaseStage) {
  get.mockImplementation((url: string) =>
    url === '/leases'
      ? Promise.resolve({ data: [buildSummary({ id: lease.id, propertyId: lease.propertyId, stage })] })
      : Promise.reject(httpError(404)),
  );
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

    // Confirmed: the draft is held back for its six seconds, still on the server.
    await waitFor(() => expect(toastUndo).toHaveBeenCalledTimes(1));
    expect(del).not.toHaveBeenCalled();

    // «Annulla»: the draft is dropped from the wait, and nothing was ever written.
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

    // The window of «Annulla» closes without it: this is what the toast runs.
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

    // The day is there, the word is not: the button waits, and Enter does not get round it.
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
    // It cannot be taken back, so no toast offers «Annulla».
    expect(toastUndo).not.toHaveBeenCalled();
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
