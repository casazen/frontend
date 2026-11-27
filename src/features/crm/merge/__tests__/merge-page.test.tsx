import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { AxiosError, type AxiosResponse } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { CrmMergeApi } from '@/api/crm-merge.api';
import type { CrmMergeCandidate, CrmMergeCandidateList, CrmMergeProfile } from '@/types/crm-merge.types';
import { MergePage } from '../merge-page';

vi.mock('@/api/crm-merge.api', () => ({
  CrmMergeApi: { getCandidates: vi.fn(), dismiss: vi.fn(), merge: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null),
}));

const ROSSI_A = '11111111-1111-4111-8111-111111111111';
const ROSSI_B = '22222222-2222-4222-8222-222222222222';
const VERDI_A = '33333333-3333-4333-8333-333333333333';
const VERDI_B = '44444444-4444-4444-8444-444444444444';
const CANDIDATE = 'c1c1c1c1-0000-4000-8000-000000000001';
const OTHER_CANDIDATE = 'c2c2c2c2-0000-4000-8000-000000000002';

function profile(id: string, overrides: Partial<CrmMergeProfile> = {}): CrmMergeProfile {
  return {
    id,
    displayName: 'Mario Rossi',
    country: 'IT',
    stays: 3,
    lastStayAt: '2026-09-14T00:00:00Z',
    propertyNames: ['Casa Mare', 'Trullo Verde'],
    contacts: [{ channel: 'Email', origin: 'DirectBooking', valueMasked: 'm***@example.it' }],
    ...overrides,
  };
}

function candidate(overrides: Partial<CrmMergeCandidate> = {}): CrmMergeCandidate {
  return {
    id: CANDIDATE,
    score: 90,
    reasons: ['same_name_birth', 'same_phone'],
    createdAt: '2026-11-01T10:00:00Z',
    profileA: profile(ROSSI_A),
    profileB: profile(ROSSI_B, {
      displayName: 'M. Rossi',
      stays: 1,
      lastStayAt: null,
      propertyNames: ['Casa Mare'],
      contacts: [{ channel: 'Phone', origin: 'CheckIn', valueMasked: '*********567' }],
    }),
    ...overrides,
  };
}

function page(items: CrmMergeCandidate[], totalCount = items.length, pageNumber = 1): CrmMergeCandidateList {
  return { items, totalCount, page: pageNumber, pageSize: 20 };
}

function problem(status: number, code: string): AxiosError {
  const response = { status, statusText: String(status), data: { code }, headers: {}, config: {} } as unknown as AxiosResponse;
  return new AxiosError(code, String(status), undefined, undefined, response);
}

function Where() {
  const location = useLocation();
  return createElement('output', { 'data-testid': 'where' }, `${location.pathname}${location.search}`);
}

function renderPage(address = '/app/short-rent/crm/merge') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[address]}>
          <MergePage />
          <Where />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const openMerge = async () => fireEvent.click(await screen.findByTestId('crm-merge-open'));
const confirmButton = () => within(screen.getByRole('dialog')).getByRole('button', { name: i18n.t('crm.merge.dialog.confirm') });

describe('MergePage: the merge proposals the host decides (E07/F01/US04/T03)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(CrmMergeApi.getCandidates).mockResolvedValue(page([candidate()]));
    vi.mocked(CrmMergeApi.merge).mockResolvedValue({} as never);
    vi.mocked(CrmMergeApi.dismiss).mockResolvedValue(undefined);
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('MergePage_Opened_ShowsTheTwoProfilesSideBySideWithTheLikelihoodAndTheReasonsInWords', async () => {
    renderPage();

    const card = within(await screen.findByTestId('crm-merge-card'));
    expect(CrmMergeApi.getCandidates).toHaveBeenCalledWith(1, 20);
    expect(card.getByTestId('crm-merge-likelihood')).toHaveTextContent('Molto probabilmente la stessa persona');
    const reasons = within(card.getByTestId('crm-merge-reasons'));
    expect(reasons.getByText('Hanno lo stesso nome e la stessa data di nascita.')).toBeInTheDocument();
    expect(reasons.getByText('Hanno lo stesso numero di telefono.')).toBeInTheDocument();

    const [first, second] = card.getAllByTestId('crm-merge-profile').map((section) => within(section));
    expect(first.getByRole('heading', { name: 'Mario Rossi' })).toBeInTheDocument();
    expect(first.getByText('IT')).toBeInTheDocument();
    expect(first.getByText('3')).toBeInTheDocument();
    expect(first.getByText('14 set 2026')).toBeInTheDocument();
    expect(first.getByText('Casa Mare, Trullo Verde')).toBeInTheDocument();
    expect(first.getByText(/E-mail · Prenotazione sul sito diretto/)).toBeInTheDocument();
    expect(first.getByText('m***@example.it')).toBeInTheDocument();
    expect(second.getByRole('heading', { name: 'M. Rossi' })).toBeInTheDocument();
    expect(second.getByText(i18n.t('crm.merge.profile.noStay'))).toBeInTheDocument();
    expect(second.getByText(/Telefono · Check-in online/)).toBeInTheDocument();
    expect(second.getByText('*********567')).toBeInTheDocument();
  });

  it('MergePage_ACard_NeverShowsADateOfBirthOrADocument', async () => {
    vi.mocked(CrmMergeApi.getCandidates).mockResolvedValue(page([candidate({ score: 90, reasons: ['same_name_birth'] })]));

    renderPage();

    const text = (await screen.findByTestId('crm-merge-card')).textContent ?? '';
    // The reason says that the birth date is the same, and that is all it says: the only date of a card is the last stay.
    expect(text).toContain('la stessa data di nascita');
    expect(text).not.toMatch(/nascita[^.]*\d/i);
    expect(text).not.toMatch(/document|passaport|codice fiscale|identity|birth date of/i);
    expect(text.match(/\d{1,2} [a-z]{3} \d{4}/gi)).toEqual(['14 set 2026']);
  });

  it.each([
    [100, 'Molto probabilmente la stessa persona'],
    [90, 'Molto probabilmente la stessa persona'],
    [80, 'Probabilmente la stessa persona'],
    [60, 'Forse la stessa persona'],
  ])('MergePage_Score%i_SaysTheLikelihoodAs_%s', async (score, words) => {
    vi.mocked(CrmMergeApi.getCandidates).mockResolvedValue(page([candidate({ score })]));

    renderPage();

    expect(await screen.findByTestId('crm-merge-likelihood')).toHaveTextContent(words);
  });

  it('MergePage_AnyReason_IsToldInWordsAndNeverAsACode', async () => {
    vi.mocked(CrmMergeApi.getCandidates).mockResolvedValue(
      page([candidate({ reasons: ['same_email', 'same_name_birth', 'same_phone', 'same_name_same_property', 'brand_new_code'] })]),
    );

    renderPage();

    const reasons = within(await screen.findByTestId('crm-merge-reasons'));
    for (const key of ['sameEmail', 'sameNameBirth', 'samePhone', 'sameNameSameProperty', 'unknown']) {
      expect(reasons.getByText(i18n.t(`crm.merge.reasons.${key}`))).toBeInTheDocument();
    }
    expect(screen.getByTestId('crm-merge-reasons').textContent).not.toMatch(/same_|brand_new_code/);
  });

  it('MergePage_Merge_AsksWhichProfileToKeepWithNoneChosenAndSaysWhatHappens', async () => {
    renderPage();
    await openMerge();

    const dialog = within(await screen.findByRole('dialog'));
    const radios = dialog.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    // None is chosen for the host, and the merge cannot be confirmed before the host chooses.
    for (const radio of radios) expect(radio).not.toBeChecked();
    expect(confirmButton()).toBeDisabled();
    // What the merge does, plainly: history and contacts move, no consent changes, it cannot be undone.
    expect(dialog.getByText(i18n.t('crm.merge.dialog.history'))).toBeInTheDocument();
    expect(dialog.getByText(i18n.t('crm.merge.dialog.consent'))).toBeInTheDocument();
    expect(dialog.getByText(i18n.t('crm.merge.dialog.final'))).toBeInTheDocument();
    expect(CrmMergeApi.merge).not.toHaveBeenCalled();
  });

  it('MergePage_MergeTheChosenProfile_SendsItsIdAndTheProposalIsGone', async () => {
    vi.mocked(CrmMergeApi.getCandidates).mockResolvedValueOnce(page([candidate()])).mockResolvedValue(page([]));
    renderPage();
    await openMerge();

    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('radio', { name: /M\. Rossi/ }));
    expect(confirmButton()).toBeEnabled();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(CrmMergeApi.merge).toHaveBeenCalledWith(CANDIDATE, ROSSI_B));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('crm.merge.mergeDone')));
    // The list reads the proposals again: the pair that was decided is not there any more.
    expect(await screen.findByText(i18n.t('crm.merge.empty.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('crm-merge-card')).not.toBeInTheDocument();
  });

  it('MergePage_TheDialogIsClosedWithoutDeciding_NothingIsSentAndNothingStaysChosen', async () => {
    renderPage();
    await openMerge();
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('radio', { name: /Mario Rossi/ }));

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: i18n.t('shared.cancel') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(CrmMergeApi.merge).not.toHaveBeenCalled();

    // The next time the choice is the host's again.
    await openMerge();
    for (const radio of within(await screen.findByRole('dialog')).getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('MergePage_NotTheSamePerson_AsksOnceAndThenTheProposalIsDismissedForGood', async () => {
    vi.mocked(CrmMergeApi.getCandidates).mockResolvedValueOnce(page([candidate()])).mockResolvedValue(page([]));
    renderPage();

    fireEvent.click(await screen.findByTestId('crm-merge-dismiss-open'));
    // Nothing happens before the host confirms.
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(i18n.t('crm.merge.dismiss.title'))).toBeInTheDocument();
    expect(CrmMergeApi.dismiss).not.toHaveBeenCalled();

    fireEvent.click(dialog.getByRole('button', { name: i18n.t('crm.merge.dismiss.confirm') }));

    await waitFor(() => expect(CrmMergeApi.dismiss).toHaveBeenCalledWith(CANDIDATE));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('crm.merge.dismissDone')));
    expect(await screen.findByText(i18n.t('crm.merge.empty.title'))).toBeInTheDocument();
    expect(CrmMergeApi.merge).not.toHaveBeenCalled();
  });

  it.each([
    ['crm_merge_not_proposed', 409, 'apiErrors.codes.crmMergeNotProposed'],
    ['crm_merge_candidate_not_found', 404, 'apiErrors.codes.crmMergeCandidateNotFound'],
    ['crm_merge_survivor_invalid', 422, 'apiErrors.codes.crmMergeSurvivorInvalid'],
  ])('MergePage_TheServerRefusesTheMergeWith_%s_ItIsToldInPlainWordsAndTheProposalsAreReadAgain', async (code, status, key) => {
    vi.mocked(CrmMergeApi.merge).mockRejectedValue(problem(status, code));
    renderPage();
    await openMerge();
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('radio', { name: /Mario Rossi/ }));

    fireEvent.click(confirmButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t(key)));
    expect(toast.success).not.toHaveBeenCalled();
    // The proposal may be decided or out of reach: the list is read again, so the page tells the truth.
    await waitFor(() => expect(vi.mocked(CrmMergeApi.getCandidates).mock.calls.length).toBeGreaterThan(1));
  });

  it.each([
    ['crm_merge_not_proposed', 409, 'apiErrors.codes.crmMergeNotProposed'],
    ['crm_merge_candidate_not_found', 404, 'apiErrors.codes.crmMergeCandidateNotFound'],
  ])('MergePage_TheServerRefusesTheDismissalWith_%s_ItIsToldInPlainWords', async (code, status, key) => {
    vi.mocked(CrmMergeApi.dismiss).mockRejectedValue(problem(status, code));
    renderPage();

    fireEvent.click(await screen.findByTestId('crm-merge-dismiss-open'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('crm.merge.dismiss.confirm') }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t(key)));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('MergePage_NothingToReview_SaysSoAndLeadsToTheProfiles', async () => {
    vi.mocked(CrmMergeApi.getCandidates).mockResolvedValue(page([]));

    renderPage();

    expect(await screen.findByText(i18n.t('crm.merge.empty.title'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('crm.merge.empty.action') })).toHaveAttribute('href', '/app/short-rent/crm/guests');
  });

  it('MergePage_TheLoadFails_ExplainsItAndOffersARetry', async () => {
    vi.mocked(CrmMergeApi.getCandidates).mockRejectedValueOnce(problem(500, 'boom')).mockResolvedValue(page([candidate()]));

    renderPage();

    expect(await screen.findByText(i18n.t('crm.merge.loadError'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(await screen.findByTestId('crm-merge-card')).toBeInTheDocument();
  });

  it('MergePage_MoreThanAPage_PagesThroughTheAddress', async () => {
    vi.mocked(CrmMergeApi.getCandidates).mockResolvedValue(page([candidate(), candidate({ id: OTHER_CANDIDATE, profileA: profile(VERDI_A), profileB: profile(VERDI_B) })], 45));

    renderPage();
    expect(await screen.findAllByTestId('crm-merge-card')).toHaveLength(2);
    expect(screen.getByTestId('crm-merge-count')).toHaveTextContent('45 proposte da rivedere');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('listView.pagination.next') }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('?page=2'));
    await waitFor(() => expect(CrmMergeApi.getCandidates).toHaveBeenLastCalledWith(2, 20));
  });

  it('MergePage_APageThatIsNotThereAnyMore_GoesToTheLastOne', async () => {
    vi.mocked(CrmMergeApi.getCandidates).mockImplementation(async (pageNumber) => (pageNumber === 2 ? page([candidate()], 21, 2) : page([], 21, pageNumber)));

    renderPage('/app/short-rent/crm/merge?page=7');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('?page=2'));
    expect(await screen.findByTestId('crm-merge-card')).toBeInTheDocument();
  });
});
