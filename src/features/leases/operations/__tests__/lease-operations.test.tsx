import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import type { LeaseDetail, LeaseOperations as LeaseOperationsData } from '@/types';
import { buildDetail, httpError, renderAt } from '../../__tests__/lease-test-utils';
import { LeaseOperations } from '../lease-operations';

// LR-OPS-1: the letters are drafts the person downloads, and a withdrawal is recorded only when its notice runs out inside the period the
// lease is in. The real client and queries run; the server is the mock of the HTTP client.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

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

const OPERATIONS: LeaseOperationsData = {
  disdetta: { available: true, firstPeriod: true, periodEnd: '2027-01-31', lastDayToGiveNotice: '2026-07-31', late: false, reasons: ['OwnUse', 'Sale'] },
  withdrawal: { available: true, minReceivedOn: '2025-11-01', maxReceivedOn: '2026-10-29', maxContractualNoticeMonths: 12, recorded: null },
  letters: [
    { kind: 'Disdetta', approved: false, sent: null },
    { kind: 'PresaAttoRecesso', approved: false, sent: null },
  ],
};

/** A lease that began on 1 November 2025 and whose period ends on 31 January 2027. */
const LEASE: LeaseDetail = buildDetail({
  status: 'Registered',
  startDate: '2025-11-01T00:00:00Z',
  endDate: '2027-01-31T00:00:00Z',
  currentTermEndDate: '2027-01-31T00:00:00Z',
});

function mockServer() {
  get.mockImplementation((url: string) => {
    if (url === '/long-rent/rules') return Promise.resolve({ data: RULES });
    if (url === '/leases/lease-1/operations') return Promise.resolve({ data: OPERATIONS });
    return Promise.reject(httpError(404));
  });
}

function renderOperations(search: string) {
  return renderAt(`/app/long-rent/leases/lease-1${search}`, '/app/long-rent/leases/:id', createElement(LeaseOperations, { lease: LEASE }));
}

describe('LeaseOperations', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    mockServer();
  });

  afterEach(cleanup);

  it('disdetta_AtTheFirstExpiry_TheLetterNeedsAReasonAndSaysItIsADraft', async () => {
    post.mockResolvedValue({ data: new Blob(['%PDF']) });
    renderOperations('?operazione=disdetta');

    expect(await screen.findByTestId('disdetta-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('disdetta-draft-note')).toBeInTheDocument();
    // No letter without one of the reasons of the law.
    const download = screen.getByTestId('disdetta-download');
    expect(download).toBeDisabled();

    fireEvent.change(screen.getByTestId('disdetta-reason'), { target: { value: 'OwnUse' } });
    expect(download).toBeEnabled();
    fireEvent.click(download);

    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/letters/disdetta', { reason: 'OwnUse' }, { responseType: 'blob' }));
  });

  it('withdrawal_ANoticeThatRunsOutAfterThePeriod_CannotBeRecorded_OneThatRunsOutInsideIs', async () => {
    post.mockResolvedValue({ data: LEASE });
    renderOperations('?operazione=recesso');

    const received = await screen.findByTestId('withdrawal-received');
    const dialog = within(screen.getByRole('dialog'));
    const effect = screen.getByTestId('withdrawal-effect');

    // Received on 20 October 2026, with the six months of the rules it would end on 20 April 2027: after the end of the period (31 January
    // 2027), so the word of the confirmation is typed and the button stays off.
    fireEvent.change(received, { target: { value: '2026-10-20' } });
    await waitFor(() => expect(effect).toHaveTextContent('dopo la fine del periodo in corso'));
    fireEvent.change(screen.getByTestId('confirmation-input'), { target: { value: 'RECESSO' } });
    expect(dialog.getByRole('button', { name: 'Registra il recesso' })).toBeDisabled();

    // Received on 20 July 2026 it ends on 20 January 2027, inside the period: nothing else is left to do.
    fireEvent.change(received, { target: { value: '2026-07-20' } });
    await waitFor(() => expect(effect).toHaveTextContent('Il contratto finirà il 20 gennaio 2027.'));
    const confirm = dialog.getByRole('button', { name: 'Registra il recesso' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/withdrawal', { receivedOn: '2026-07-20', reason: 'GraveMotivi' }, undefined));
    expect(post).toHaveBeenCalledTimes(1);
  });
});
