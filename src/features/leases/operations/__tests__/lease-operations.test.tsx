import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { LeaseDetail, LeaseOperations as LeaseOperationsData } from '@/types';
import { buildDetail, httpError, renderAt } from '../../__tests__/lease-test-utils';
import { addMonths } from '../../wizard/wizard-model';
import { LeaseOperations } from '../lease-operations';
import { yearsHeld } from '../operations-model';

// LR-OPS-1: the letters are drafts the person downloads, a withdrawal is recorded only when its notice runs out inside the period the lease
// is in, a renewal only in its window and never over another lease of the property, the need of a transitory lease is confirmed only when it
// is the landlord's, and the rent is updated by the ISTAT variation with the numbers the server works out (never under the cedolare secca).
// The real client and queries run; the server is the mock of the HTTP client.
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

const TODAY = todayInRome();
const PAID = addMonths(TODAY, -14);

const OPERATIONS: LeaseOperationsData = {
  disdetta: { available: true, firstPeriod: true, periodEnd: '2027-01-31', lastDayToGiveNotice: '2026-07-31', late: false, reasons: ['OwnUse', 'Sale'] },
  withdrawal: { available: true, minReceivedOn: '2025-11-01', maxReceivedOn: '2026-10-29', maxContractualNoticeMonths: 12, recorded: null },
  letters: [
    { kind: 'Disdetta', approved: false, sent: null },
    { kind: 'PresaAttoRecesso', approved: false, sent: null },
    { kind: 'Rinnovo', approved: false, sent: null },
    { kind: 'ConfermaEsigenza', approved: false, sent: null },
    { kind: 'AggiornamentoIstat', approved: false, sent: null },
    { kind: 'OpzioneCedolare', approved: false, sent: null },
    { kind: 'Riconsegna', approved: false, sent: null },
    { kind: 'RestituzioneCauzione', approved: false, sent: null },
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
  istat: { available: true, currentRent: 650, defaultSharePercent: 75, maxSharePercent: 100, minEffectiveOn: '2026-10-10', maxEffectiveOn: '2027-01-31' },
  cedolareNotice: { available: false, minEffectiveOn: '2025-11-01', maxEffectiveOn: '2027-01-31' },
  handover: { available: false, minOn: '2025-11-01', maxOn: '2028-01-31', suggestedOn: '2027-01-31' },
  deposit: {
    available: false,
    amount: 1950,
    paidOn: PAID,
    minPaidOn: addMonths(PAID, -12),
    suggestedReturnOn: TODAY,
    maxReturnOn: addMonths(TODAY, 36),
    maxDeductions: 20,
    recorded: null,
  },
};

const NOTHING_TO_DO: LeaseOperationsData = {
  ...OPERATIONS,
  disdetta: { ...OPERATIONS.disdetta, available: false },
  withdrawal: { ...OPERATIONS.withdrawal, available: false },
  renewal: { ...OPERATIONS.renewal, available: false },
  istat: { ...OPERATIONS.istat, available: false },
};

const LEASE: LeaseDetail = buildDetail({
  status: 'Registered',
  startDate: '2025-11-01T00:00:00Z',
  endDate: '2027-01-31T00:00:00Z',
  currentTermEndDate: '2027-01-31T00:00:00Z',
});

const CALCULATION = { currentRent: 650, foiPercent: 3.2, sharePercent: 75, appliedPercent: 2.4, increase: 15.6, newRent: 665.6 };

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

    fireEvent.change(received, { target: { value: '2026-10-20' } });
    await waitFor(() => expect(effect).toHaveTextContent('dopo la fine del periodo in corso'));
    fireEvent.change(screen.getByTestId('confirmation-input'), { target: { value: 'RECESSO' } });
    expect(dialog.getByRole('button', { name: 'Registra il recesso' })).toBeDisabled();

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

    fireEvent.change(end, { target: { value: '2027-01-31' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(end, { target: { value: '2047-02-01' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(end, { target: { value: '2028-01-31' } });
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(post).not.toHaveBeenCalled();
  });

  it('renewal_TheRowFollowsTheWindow_AndOnceRecordedOffersTheNextStepsWithTheAgreement', async () => {
    mockServer(NOTHING_TO_DO);
    const { unmount } = renderOperations('');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/leases/lease-1/operations', expect.anything()));
    await settled();
    expect(screen.queryByTestId('lease-operations')).not.toBeInTheDocument();
    unmount();

    mockServer({ ...NOTHING_TO_DO, renewal: { ...OPERATIONS.renewal, available: false, recorded: { agreed: false, from: '2027-02-01', to: '2031-01-31' } } });
    post.mockResolvedValue({ data: new Blob(['%PDF']) });
    renderOperations('?operazione=rinnovo');

    expect(await screen.findByTestId('lease-operation-rinnovo-summary')).toHaveTextContent('Rinnovo registrato: il contratto continua fino al 31 gennaio 2031.');
    const done = await screen.findByTestId('renewal-done-dialog');
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
    mockServer({ ...NOTHING_TO_DO, transitoryConfirmation: { applies: true, available: false, holder: 'Tenant', confirmBy: '2027-01-31' } });
    const { unmount } = renderOperations('?operazione=conferma-esigenza');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/leases/lease-1/operations', expect.anything()));
    await settled();
    expect(screen.queryByTestId('lease-operations')).not.toBeInTheDocument();
    expect(screen.queryByTestId('need-confirmation-dialog')).not.toBeInTheDocument();
    unmount();

    mockServer({ ...NOTHING_TO_DO, transitoryConfirmation: { applies: true, available: true, holder: 'Landlord', confirmBy: '2027-01-31' } });
    post.mockResolvedValue({ data: new Blob(['%PDF']) });
    renderOperations('?operazione=conferma-esigenza');

    const dialog = await screen.findByTestId('need-confirmation-dialog');
    expect(within(dialog).getByTestId('need-confirmation-facts')).toHaveTextContent('il 31 gennaio 2027');
    expect(within(dialog).getByTestId('need-confirmation-draft-note')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByTestId('need-confirmation-download'));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/letters/conferma-esigenza', {}, { responseType: 'blob' }));
  });

  it('istat_TheServerWorksOutTheNewRent_AndTheLetterIsAskedForWithThoseNumbers', async () => {
    post.mockImplementation((url: string) =>
      url === '/leases/lease-1/istat/calculate' ? Promise.resolve({ data: CALCULATION }) : Promise.resolve({ data: new Blob(['%PDF']) }),
    );
    renderOperations('?operazione=istat');

    const dialog = within(await screen.findByTestId('istat-dialog'));
    const download = dialog.getByTestId('istat-download');
    expect(download).toBeDisabled();
    expect(dialog.getByTestId('istat-share')).toHaveValue('75');
    expect(dialog.getByTestId('istat-draft-note')).toBeInTheDocument();

    fireEvent.change(dialog.getByTestId('istat-foi'), { target: { value: '3,2' } });
    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/istat/calculate', { foiPercent: 3.2, sharePercent: 75 }, undefined));
    await waitFor(() => expect(dialog.getByTestId('istat-result')).toHaveTextContent('665,60'));
    expect(download).toBeEnabled();
    fireEvent.click(download);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/leases/lease-1/letters/aggiornamento-istat',
        { foiPercent: 3.2, sharePercent: 75, effectiveFrom: '2026-11-01' },
        { responseType: 'blob' },
      ),
    );
  });

  it('istat_ARefusalOfTheServer_IsToldInPlaceOfTheFigure_AndNothingCanBeDownloaded', async () => {
    post.mockRejectedValue(httpError(422, { code: 'lease_istat_no_increase', detail: 'Con una variazione nulla o negativa il canone non aumenta.' }));
    renderOperations('?operazione=istat');

    const dialog = within(await screen.findByTestId('istat-dialog'));
    fireEvent.change(dialog.getByTestId('istat-foi'), { target: { value: '0,001' } });

    await waitFor(() => expect(dialog.getByTestId('istat-result')).toHaveTextContent('il canone non aumenta'));
    expect(dialog.getByTestId('istat-download')).toBeDisabled();

    fireEvent.change(dialog.getByTestId('istat-foi'), { target: { value: '-1' } });
    expect(await dialog.findByText(/Scrivi una percentuale maggiore di zero/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('handover_OnlyOnceTheLeaseIsEnding_TheMinutesAreDownloadedWithTheDayOfTheLease', async () => {
    const { unmount } = renderOperations('?operazione=riconsegna');
    expect(await screen.findByTestId('lease-operation-disdetta')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-operation-riconsegna')).not.toBeInTheDocument();
    expect(screen.queryByTestId('handover-dialog')).not.toBeInTheDocument();
    unmount();

    mockServer({ ...OPERATIONS, handover: { ...OPERATIONS.handover, available: true } });
    post.mockResolvedValue({ data: new Blob(['%PDF']) });
    renderOperations('?operazione=riconsegna');

    const dialog = within(await screen.findByTestId('handover-dialog'));
    expect(dialog.getByTestId('handover-day')).toHaveValue('2027-01-31');
    expect(dialog.getByTestId('handover-draft-note')).toBeInTheDocument();
    fireEvent.click(dialog.getByTestId('handover-download'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/letters/riconsegna', { handoverOn: '2027-01-31' }, { responseType: 'blob' }));
    await waitFor(() => expect(dialog.getByTestId('handover-download')).toBeEnabled());

    fireEvent.change(dialog.getByTestId('handover-day'), { target: { value: '' } });
    fireEvent.click(dialog.getByTestId('handover-download'));
    await waitFor(() => expect(post).toHaveBeenLastCalledWith('/leases/lease-1/letters/riconsegna', {}, { responseType: 'blob' }));
  });

  it('deposit_TheRatesAreTypedYearByYear_TheServerWorksTheStatementOut_AndTheDraftAndTheRecordUseTheSameInput', async () => {
    const years = yearsHeld(PAID, TODAY);
    const ending = { ...OPERATIONS, deposit: { ...OPERATIONS.deposit, available: true } };
    const statement = {
      deposit: 1950,
      from: PAID,
      to: TODAY,
      years: years.map((year) => ({ year, ratePercent: 2, days: 100, daysInYear: 365, interest: 10 })),
      interest: 30.63,
      interestPaid: 0,
      interestDue: 30.63,
      deductions: [{ reason: 'Pulizie straordinarie', amount: 120 }],
      deductionsTotal: 120,
      returned: 1860.63,
    };
    mockServer(ending);
    post.mockImplementation((url: string) => {
      if (url === '/leases/lease-1/deposit/calculate') return Promise.resolve({ data: statement });
      if (url === '/leases/lease-1/deposit/return') {
        return Promise.resolve({
          data: { ...ending, deposit: { ...ending.deposit, recorded: { returnedOn: TODAY, deposit: 1950, interestDue: 30.63, deductions: 120, returned: 1860.63 } } },
        });
      }
      return Promise.resolve({ data: new Blob(['%PDF']) });
    });
    renderOperations('?operazione=cauzione');

    const dialog = within(await screen.findByTestId('deposit-dialog'));
    expect(dialog.getByTestId('deposit-draft-note')).toBeInTheDocument();
    expect(dialog.getByTestId('deposit-download')).toBeDisabled();
    expect(dialog.getByTestId('deposit-record')).toBeDisabled();
    for (const year of years) fireEvent.change(dialog.getByTestId(`deposit-rate-${year}`), { target: { value: '2' } });
    fireEvent.click(dialog.getByTestId('deposit-add-deduction'));
    fireEvent.change(dialog.getByTestId('deposit-deduction-reason-1'), { target: { value: 'Pulizie straordinarie' } });
    fireEvent.change(dialog.getByTestId('deposit-deduction-amount-1'), { target: { value: '120,00' } });

    const sent = {
      returnedOn: TODAY,
      depositPaidOn: PAID,
      rates: years.map((year) => ({ year, ratePercent: 2 })),
      deductions: [{ reason: 'Pulizie straordinarie', amount: 120 }],
    };
    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/deposit/calculate', sent, undefined));
    await waitFor(() => expect(dialog.getByTestId('deposit-result')).toHaveTextContent(/1\.?860,63/));
    expect(dialog.getByTestId('deposit-years').querySelectorAll('li')).toHaveLength(years.length);

    fireEvent.click(dialog.getByTestId('deposit-download'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/letters/restituzione-cauzione', sent, { responseType: 'blob' }));
    fireEvent.click(dialog.getByTestId('deposit-record'));
    expect(post).not.toHaveBeenCalledWith('/leases/lease-1/deposit/return', expect.anything(), undefined);
    fireEvent.click(await dialog.findByTestId('deposit-confirm-yes'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/deposit/return', sent, undefined));
  });

  it('deposit_AReturnThatHasNotHappened_CanBeWorkedOutButNotRecorded_AndAReturnedDepositShowsOnTheRow', async () => {
    const ending = { ...OPERATIONS, deposit: { ...OPERATIONS.deposit, available: true } };
    const tomorrow = addDays(TODAY, 1);
    const years = yearsHeld(PAID, tomorrow);
    mockServer(ending);
    post.mockResolvedValue({
      data: {
        deposit: 1950,
        from: PAID,
        to: tomorrow,
        years: [],
        interest: 30.63,
        interestPaid: 0,
        interestDue: 30.63,
        deductions: [],
        deductionsTotal: 0,
        returned: 1980.63,
      },
    });
    const { unmount } = renderOperations('?operazione=cauzione');

    const dialog = within(await screen.findByTestId('deposit-dialog'));
    fireEvent.change(dialog.getByTestId('deposit-returned-on'), { target: { value: tomorrow } });
    for (const year of years) fireEvent.change(dialog.getByTestId(`deposit-rate-${year}`), { target: { value: '2,5' } });
    await waitFor(() => expect(dialog.getByTestId('deposit-result')).toHaveTextContent(/1\.?980,63/));

    expect(dialog.getByTestId('deposit-download')).toBeEnabled();
    expect(dialog.getByTestId('deposit-record')).toBeDisabled();
    unmount();

    mockServer({
      ...ending,
      deposit: { ...ending.deposit, recorded: { returnedOn: TODAY, deposit: 1950, interestDue: 30.63, deductions: 120, returned: 1860.63 } },
    });
    renderOperations('');
    expect(await screen.findByTestId('lease-operation-cauzione-summary')).toHaveTextContent('Cauzione restituita');
    expect(screen.getByTestId('lease-operation-cauzione-summary')).toHaveTextContent(/1\.?860,63/);
  });

  it('istat_UnderTheCedolareSecca_TheUpdateIsOffNoRowAndNoWindow_AndTheCommunicationOfTheOptionIsOn', async () => {
    // An ordinary lease: the update is offered, the communication of the cedolare secca is not.
    const { unmount } = renderOperations('');
    expect(await screen.findByTestId('lease-operation-istat')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-operation-cedolare')).not.toBeInTheDocument();
    unmount();

    // Under the cedolare secca it is the other way round, and the address of the update opens nothing.
    mockServer({
      ...NOTHING_TO_DO,
      cedolareNotice: { available: true, minEffectiveOn: '2025-11-01', maxEffectiveOn: '2027-01-31' },
    });
    post.mockResolvedValue({ data: new Blob(['%PDF']) });
    renderOperations('?operazione=istat');
    expect(await screen.findByTestId('lease-operation-cedolare')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-operation-istat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('istat-dialog')).not.toBeInTheDocument();
    cleanup();

    renderOperations('?operazione=cedolare');
    const dialog = within(await screen.findByTestId('cedolare-dialog'));
    expect(dialog.getByTestId('cedolare-draft-note')).toBeInTheDocument();

    fireEvent.click(dialog.getByTestId('cedolare-download'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/letters/opzione-cedolare', {}, { responseType: 'blob' }));
    await waitFor(() => expect(dialog.getByTestId('cedolare-download')).toBeEnabled());
    fireEvent.change(dialog.getByTestId('cedolare-effective'), { target: { value: '2026-11-01' } });
    fireEvent.click(dialog.getByTestId('cedolare-download'));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/leases/lease-1/letters/opzione-cedolare', { effectiveFrom: '2026-11-01' }, { responseType: 'blob' }),
    );
  });
});
