import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import type { LeaseDetail, LeaseOperations as LeaseOperationsData } from '@/types';
import { buildDetail, httpError, renderAt } from '../../__tests__/lease-test-utils';
import { LeaseOperations } from '../lease-operations';

// LR-OPS-1: the letters are drafts the person downloads, a withdrawal is recorded only when its notice runs out inside the period the lease
// is in, a renewal only in its window and never over another lease of the property, and the need of a transitory lease is confirmed only
// when it is the landlord's. The real client and queries run; the server is the mock of the HTTP client.
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
    { kind: 'Rinnovo', approved: false, sent: null },
    { kind: 'ConfermaEsigenza', approved: false, sent: null },
  ],
  renewal: {
    available: true,
    opensOn: '2026-07-31',
    startsOn: '2027-02-01',
    standardEnd: '2031-01-31',
    standardMonths: 48,
    latestAgreedEnd: '2047-01-31',
    conflict: null,
    recorded: null,
  },
  transitoryConfirmation: { applies: false, available: false, holder: null, confirmBy: '2027-01-31' },
};

/** A lease that began on 1 November 2025 and whose period ends on 31 January 2027. */
const LEASE: LeaseDetail = buildDetail({
  status: 'Registered',
  startDate: '2025-11-01T00:00:00Z',
  endDate: '2027-01-31T00:00:00Z',
  currentTermEndDate: '2027-01-31T00:00:00Z',
});

function mockServer(operations: LeaseOperationsData = OPERATIONS) {
  get.mockImplementation((url: string) => {
    if (url === '/long-rent/rules') return Promise.resolve({ data: RULES });
    if (url === '/leases/lease-1/operations') return Promise.resolve({ data: operations });
    return Promise.reject(httpError(404));
  });
}

function renderOperations(search: string) {
  return renderAt(`/app/long-rent/leases/lease-1${search}`, '/app/long-rent/leases/:id', createElement(LeaseOperations, { lease: LEASE }));
}

/** Lets the answer of the mocked server reach the screen: what must NOT be there is checked after this, not before the answer exists. */
async function settled() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
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

  it('renewal_TheStandardOneIsRecordedWithNoDay_TheServerSetsTheEnd', async () => {
    post.mockResolvedValue({ data: LEASE });
    renderOperations('?operazione=rinnovo');

    const effect = await screen.findByTestId('renewal-effect');
    // The end is the one the server computed with the months of the rules: 48 months from 1 February 2027.
    expect(effect).toHaveTextContent('Il contratto continuerà fino al 31 gennaio 2031.');
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Registra il rinnovo' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/renewal', {}, undefined));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('renewal_AnotherLeaseOfThePropertyInTheWay_BlocksTheStandardOne_AnAgreedEndBeforeItIsFine', async () => {
    mockServer({
      ...OPERATIONS,
      renewal: { ...OPERATIONS.renewal, conflict: { leaseId: 'lease-2', from: '2028-06-01', to: '2032-05-31' } },
    });
    post.mockResolvedValue({ data: LEASE });
    renderOperations('?operazione=rinnovo');

    const dialog = within(await screen.findByRole('dialog'));
    const confirm = dialog.getByRole('button', { name: 'Registra il rinnovo' });
    // The next tenant starts on 1 June 2028, inside the 48 months: the warning names the way to that lease and the button stays off.
    expect(await screen.findByTestId('lease-period-conflict')).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    // An extension agreed up to 31 May 2028 stops before the other lease starts: nothing is in the way any more.
    fireEvent.click(dialog.getByRole('radio', { name: /Proroga a un giorno concordato/ }));
    const end = await screen.findByTestId('renewal-agreed-end');
    fireEvent.change(end, { target: { value: '2028-05-31' } });
    await waitFor(() => expect(screen.queryByTestId('lease-period-conflict')).not.toBeInTheDocument());
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/renewal', { newEnd: '2028-05-31' }, undefined));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('renewal_AnAgreedEndMustFallAfterThePeriod_AndNotFurtherThanTheServerAllows', async () => {
    renderOperations('?operazione=rinnovo');

    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('radio', { name: /Proroga a un giorno concordato/ }));
    const end = await screen.findByTestId('renewal-agreed-end');
    const confirm = dialog.getByRole('button', { name: 'Registra il rinnovo' });
    expect(confirm).toBeDisabled();

    // The last day of the period itself, and a day beyond the limit the server states: both are refused before anything is sent.
    fireEvent.change(end, { target: { value: '2027-01-31' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(end, { target: { value: '2047-02-01' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(end, { target: { value: '2028-01-31' } });
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(post).not.toHaveBeenCalled();
  });

  it('renewal_TheRowFollowsTheWindow_AndOnceRecordedOffersTheNextStepsWithTheAgreement', async () => {
    // Window closed and nothing recorded: no row at all.
    mockServer({
      ...OPERATIONS,
      disdetta: { ...OPERATIONS.disdetta, available: false },
      withdrawal: { ...OPERATIONS.withdrawal, available: false },
      renewal: { ...OPERATIONS.renewal, available: false },
    });
    const { unmount } = renderOperations('');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/leases/lease-1/operations', expect.anything()));
    await settled();
    expect(screen.queryByTestId('lease-operations')).not.toBeInTheDocument();
    unmount();

    // Window closed and recorded: the row says where the contract goes on to, and the window offers the next steps and the agreement.
    mockServer({
      ...OPERATIONS,
      disdetta: { ...OPERATIONS.disdetta, available: false },
      withdrawal: { ...OPERATIONS.withdrawal, available: false },
      renewal: { ...OPERATIONS.renewal, available: false, recorded: { agreed: false, from: '2027-02-01', to: '2031-01-31' } },
    });
    post.mockResolvedValue({ data: new Blob(['%PDF']) });
    renderOperations('?operazione=rinnovo');

    expect(await screen.findByTestId('lease-operation-rinnovo-summary')).toHaveTextContent('Rinnovo registrato: il contratto continua fino al 31 gennaio 2031.');
    const done = await screen.findByTestId('renewal-done-dialog');
    // The days to communicate the renewal are the ones of the rules, which arrive after the window is drawn.
    await waitFor(() => expect(within(done).getByTestId('renewal-next-steps')).toHaveTextContent('entro 30 giorni'));
    expect(within(done).getByTestId('renewal-draft-note')).toBeInTheDocument();
    fireEvent.click(within(done).getByTestId('renewal-download'));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/leases/lease-1/letters/rinnovo',
        { startsOn: '2027-02-01', endsOn: '2031-01-31', agreed: false },
        { responseType: 'blob' },
      ),
    );
  });

  it('renewal_WhenTheNextWindowOpens_TheOldRecordIsHistory_AndTheRowOffersTheFormAgain', async () => {
    mockServer({
      ...OPERATIONS,
      renewal: { ...OPERATIONS.renewal, available: true, recorded: { agreed: false, from: '2023-02-01', to: '2027-01-31' } },
    });
    renderOperations('?operazione=rinnovo');

    expect(await screen.findByTestId('lease-operation-rinnovo-summary')).toHaveTextContent('Il periodo finisce il 31 gennaio 2027.');
    expect(await screen.findByTestId('renewal-effect')).toBeInTheDocument();
    expect(screen.queryByTestId('renewal-done-dialog')).not.toBeInTheDocument();
  });

  it('needConfirmation_OnlyWhenTheNeedIsTheLandlords_ThePersonDownloadsTheDraftOfTheLetter', async () => {
    // The need is the tenant's: there is no letter to prepare, so there is no row and the address opens nothing.
    mockServer({
      ...OPERATIONS,
      disdetta: { ...OPERATIONS.disdetta, available: false },
      withdrawal: { ...OPERATIONS.withdrawal, available: false },
      renewal: { ...OPERATIONS.renewal, available: false },
      transitoryConfirmation: { applies: true, available: false, holder: 'Tenant', confirmBy: '2027-01-31' },
    });
    const { unmount } = renderOperations('?operazione=conferma-esigenza');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/leases/lease-1/operations', expect.anything()));
    await settled();
    expect(screen.queryByTestId('lease-operations')).not.toBeInTheDocument();
    expect(screen.queryByTestId('need-confirmation-dialog')).not.toBeInTheDocument();
    unmount();

    mockServer({
      ...OPERATIONS,
      disdetta: { ...OPERATIONS.disdetta, available: false },
      renewal: { ...OPERATIONS.renewal, available: false },
      transitoryConfirmation: { applies: true, available: true, holder: 'Landlord', confirmBy: '2027-01-31' },
    });
    post.mockResolvedValue({ data: new Blob(['%PDF']) });
    renderOperations('?operazione=conferma-esigenza');

    const dialog = await screen.findByTestId('need-confirmation-dialog');
    expect(within(dialog).getByTestId('need-confirmation-facts')).toHaveTextContent('il 31 gennaio 2027');
    expect(within(dialog).getByTestId('need-confirmation-draft-note')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByTestId('need-confirmation-download'));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/letters/conferma-esigenza', {}, { responseType: 'blob' }));
  });
});
