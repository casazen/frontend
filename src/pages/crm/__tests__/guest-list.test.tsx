import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { CrmApi } from '@/api/crm.api';
import type { CrmProfileList, CrmProfileListItem } from '@/types/crm.types';
import GuestList from '../GuestList';

vi.mock('@/api/crm.api', () => ({
  CrmApi: { getGuests: vi.fn() },
}));
const permissions = vi.hoisted(() => ({ canWrite: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permissions.canWrite || permission !== 'guest.write' }),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null),
}));

const ROSSI = '0b8f5d6e-1111-4a22-8333-aaaaaaaaaaa1';
const LEAD = '0b8f5d6e-2222-4a22-8333-aaaaaaaaaaa2';

function profile(overrides: Partial<CrmProfileListItem> = {}): CrmProfileListItem {
  return {
    id: ROSSI,
    displayName: 'Mario Rossi',
    country: 'IT',
    language: 'it',
    totalStays: 3,
    totalSpend: 1240,
    firstStayAt: '2025-06-10T00:00:00Z',
    lastStayAt: '2026-09-14T00:00:00Z',
    channels: ['Direct', 'Airbnb'],
    tags: ['vip'],
    emailMasked: 'm***@example.it',
    emailBasis: 'Consent',
    emailReachable: true,
    whatsappBasis: 'None',
    hasMergeProposal: false,
    ...overrides,
  };
}

function page(items: CrmProfileListItem[], totalCount = items.length, pageNumber = 1): CrmProfileList {
  return { items, totalCount, page: pageNumber, pageSize: 20 };
}

function Where() {
  const location = useLocation();
  return createElement('output', { 'data-testid': 'where' }, `${location.pathname}${location.search}`);
}

function renderList(address = '/app/short-rent/crm/guests') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [address] }, createElement(GuestList), createElement(Where))),
    ),
  );
}

const findTable = () => screen.findByRole('table', { name: i18n.t('crm.list.label') });
const lastAsked = () => vi.mocked(CrmApi.getGuests).mock.calls.at(-1)?.[0];

describe('GuestList: the CRM profiles of the host (E07/F01/US04/T01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    permissions.canWrite = true;
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile()]));
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('GuestList_Opens_ShowsTheProfileWithItsFiguresChannelsTagsAndEmailState', async () => {
    renderList();

    const table = within(await findTable());
    expect(table.getByRole('rowheader', { name: /Mario Rossi/ })).toBeInTheDocument();
    expect(table.getByText('3')).toBeInTheDocument();
    // Italian groups the thousands from five digits on, English from four: either way the amount is there, in euro.
    expect(table.getByText(/1\.?240,00/)).toBeInTheDocument();
    expect(table.getByText('14 set 2026')).toBeInTheDocument();
    expect(table.getByText('Sito diretto')).toBeInTheDocument();
    expect(table.getByText('Airbnb')).toBeInTheDocument();
    expect(table.getByText('vip')).toBeInTheDocument();
    expect(table.getByTestId('contact-state-badge')).toHaveAttribute('data-state', 'consent');
    // The address is masked by the server, and the page shows it as it came.
    expect(table.getByText('m***@example.it')).toBeInTheDocument();
    expect(CrmApi.getGuests).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20, sort: 'lastStay' }));
  });

  it('GuestList_Opens_NeverShowsNorAsksForADocumentABirthDateOrABirthPlace', async () => {
    renderList('/app/short-rent/crm/guests?country=IT');

    await findTable();
    // The panel of the filters is open (a filter is on): every control of the page is on screen.
    expect(screen.getByTestId('crm-filters-panel')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/document|nascita|birth|passaporto|passport/i);
    for (const control of screen.getAllByRole('textbox')) {
      expect(control.getAttribute('name') ?? '').not.toMatch(/document|birth|nascita/i);
    }
  });

  it('GuestList_ALeadWithoutAName_IsKnownByItsMaskedAddress', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile({ id: LEAD, displayName: '', emailMasked: 'l***@example.it', totalStays: 0 })]));

    renderList();

    const table = within(await findTable());
    expect(table.getByRole('rowheader', { name: /l\*\*\*@example\.it/ })).toBeInTheDocument();
  });

  it('GuestList_AProfileWithAMergeProposal_IsMarked', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile({ hasMergeProposal: true }), profile({ id: LEAD, displayName: 'Anna Verdi' })]));

    renderList();

    const table = within(await findTable());
    expect(table.getAllByTestId('crm-merge-mark')).toHaveLength(1);
    const marked = table.getByTestId(`crm-profile-row-${ROSSI}`);
    expect(within(marked).getByText(i18n.t('crm.list.mergeProposal'))).toBeInTheDocument();
  });

  it('GuestList_TheMarkOfAProposal_PointsToTheDuplicatesForWhoMayDecideThem', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile({ hasMergeProposal: true })]));

    renderList();

    const mark = within(await findTable()).getByTestId('crm-merge-mark');
    expect(mark).toHaveAttribute('title', i18n.t('crm.list.mergeProposalHint'));
    expect(mark.getAttribute('title')).toMatch(/duplicati/);
  });

  it('GuestList_TheMarkOfAProposal_DoesNotSendWhoMayOnlyReadToAPageTheyCannotOpen', async () => {
    permissions.canWrite = false;
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile({ hasMergeProposal: true })]));

    renderList();

    // The mark is there (a profile with a duplicate is worth a look), and says who decides; the page of the duplicates is not named.
    const mark = within(await findTable()).getByTestId('crm-merge-mark');
    expect(mark).toHaveAttribute('title', i18n.t('crm.list.mergeProposalHintReadOnly'));
    expect(mark.getAttribute('title')).not.toMatch(/duplicati/);
    expect(within(mark).queryByRole('link')).not.toBeInTheDocument();
  });

  it.each(['it', 'en'])('GuestList_TheTwoHintsOfTheMark_ExistInBothLanguagesAndOnlyTheFirstNamesTheDuplicates (%s)', async (language) => {
    await i18n.changeLanguage(language);

    const decide = i18n.t('crm.list.mergeProposalHint');
    const readOnly = i18n.t('crm.list.mergeProposalHintReadOnly');

    expect(readOnly).not.toBe('crm.list.mergeProposalHintReadOnly');
    expect(readOnly).not.toBe(decide);
    expect(decide).toMatch(/duplicat/i);
    expect(readOnly).not.toMatch(/duplicat/i);
  });

  it('GuestList_ARow_OpensTheProfile', async () => {
    renderList();

    const table = within(await findTable());
    expect(table.getByRole('link', { name: 'Mario Rossi' })).toHaveAttribute('href', `/app/short-rent/crm/guests/${ROSSI}`);
    fireEvent.click(table.getByTestId(`crm-profile-row-${ROSSI}`));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`/app/short-rent/crm/guests/${ROSSI}`));
  });

  it('GuestList_TheSearch_GoesToTheAddressAndToTheServer', async () => {
    renderList();
    await findTable();

    fireEvent.change(screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') }), { target: { value: 'rossi' } });

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('?q=rossi'));
    await waitFor(() => expect(lastAsked()).toMatchObject({ search: 'rossi', page: 1 }));
  });

  it('GuestList_ASearchWithASpaceAfterTheFirstWord_KeepsTheSpaceInTheBoxAndSendsItTrimmed', async () => {
    renderList();
    await findTable();
    const box = screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') });

    fireEvent.change(box, { target: { value: 'mario ' } });

    await waitFor(() => expect(lastAsked()).toMatchObject({ search: 'mario' }));
    expect(screen.getByTestId('where')).toHaveTextContent('?q=mario');
    // The host is still typing "mario rossi": the space they typed is not taken away under their fingers.
    expect(box).toHaveValue('mario ');
  });

  it.each(['mario.rossi@example.it', '+39 333 1234567'])('GuestList_ASearchBy_%s_GoesToTheServerAndNeverToTheAddress', async (text) => {
    renderList('/app/short-rent/crm/guests?sort=spend');
    await findTable();
    const box = screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') });

    fireEvent.change(box, { target: { value: text } });

    await waitFor(() => expect(lastAsked()).toMatchObject({ search: text, page: 1, sort: 'spend' }));
    // The rest of the view is in the address; the e-mail address or the phone number is not (history of the browser, shared link).
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/app\/short-rent\/crm\/guests\?sort=spend$/);
    expect(box).toHaveValue(text);
  });

  it('GuestList_ASearchByEmailThenAName_WritesOnlyTheNameToTheAddress', async () => {
    renderList('/app/short-rent/crm/guests?sort=spend');
    await findTable();
    const box = screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') });
    fireEvent.change(box, { target: { value: 'mario.rossi@example.it' } });
    await waitFor(() => expect(lastAsked()).toMatchObject({ search: 'mario.rossi@example.it' }));

    fireEvent.change(box, { target: { value: 'rossi' } });

    await waitFor(() => expect(lastAsked()).toMatchObject({ search: 'rossi' }));
    expect(screen.getByTestId('where')).toHaveTextContent('?sort=spend&q=rossi');
  });

  it('GuestList_ASearchByEmailAndAnotherPage_StaysOnTheSearchAndOutOfTheAddress', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile()], 45));
    renderList();
    await findTable();
    fireEvent.change(screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') }), { target: { value: 'mario.rossi@example.it' } });
    await waitFor(() => expect(lastAsked()).toMatchObject({ search: 'mario.rossi@example.it', page: 1 }));

    fireEvent.click(screen.getByRole('button', { name: i18n.t('listView.pagination.next') }));

    await waitFor(() => expect(lastAsked()).toMatchObject({ search: 'mario.rossi@example.it', page: 2 }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/app\/short-rent\/crm\/guests\?page=2$/);
  });

  it('GuestList_ClearTheFilters_AlsoForgetsASearchByEmail', async () => {
    renderList();
    await findTable();
    const box = screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') });
    fireEvent.change(box, { target: { value: 'mario.rossi@example.it' } });
    await waitFor(() => expect(lastAsked()).toMatchObject({ search: 'mario.rossi@example.it' }));

    // The search is on, so the way out is there even though the address has nothing.
    fireEvent.click(await screen.findByTestId('crm-filters-clear'));

    await waitFor(() => expect(box).toHaveValue(''));
    await waitFor(() => expect(lastAsked()?.search).toBeUndefined());
  });

  it('GuestList_TheSearchBox_SaysWhatItFindsInTheHint', async () => {
    renderList();
    await findTable();

    const box = screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') });
    expect(box).toHaveAccessibleDescription(i18n.t('crm.filters.search.hint'));
  });

  it.each(['it', 'en'])('GuestList_TheCountryFilter_SaysItWantsTheIsoCodeBecauseItFindsTheExactValueSaved (%s)', async (language) => {
    await i18n.changeLanguage(language);
    renderList('/app/short-rent/crm/guests?country=IT');
    await findTable();

    const hint = i18n.t('crm.filters.country.hint');
    expect(hint).toMatch(/ISO/);
    expect(screen.getByLabelText(i18n.t('crm.filters.country.label'))).toHaveAccessibleDescription(hint);
  });

  it('GuestList_AFilter_IsInTheAddressAndGoesBackToTheFirstPage', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile()], 45, 3));
    renderList('/app/short-rent/crm/guests?page=3&sort=spend');
    await findTable();
    expect(lastAsked()).toMatchObject({ page: 3, sort: 'spend' });

    fireEvent.click(screen.getByTestId('crm-filters-toggle'));
    fireEvent.change(screen.getByLabelText(i18n.t('crm.filters.channel.label')), { target: { value: 'Airbnb' } });
    fireEvent.change(screen.getByLabelText(i18n.t('crm.filters.email.label')), { target: { value: 'reachable' } });

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('?sort=spend&channel=Airbnb&email=reachable'));
    await waitFor(() => expect(lastAsked()).toMatchObject({ channel: 'Airbnb', reachableByEmail: true, sort: 'spend', page: 1 }));
  });

  it('GuestList_AViewInTheAddress_SurvivesAReload', async () => {
    renderList('/app/short-rent/crm/guests?q=rossi&country=IT&channel=BookingCom&minStays=2&email=unreachable&sort=name');

    await findTable();
    expect(lastAsked()).toMatchObject({
      search: 'rossi',
      country: 'IT',
      channel: 'BookingCom',
      minStays: 2,
      reachableByEmail: false,
      sort: 'name',
      page: 1,
    });
    // The panel is open with what the address asks for.
    expect(screen.getByLabelText(i18n.t('crm.filters.channel.label'))).toHaveValue('BookingCom');
    expect(screen.getByLabelText(i18n.t('crm.filters.country.label'))).toHaveValue('IT');
    expect(screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') })).toHaveValue('rossi');
  });

  it('GuestList_ClearTheFilters_PutsTheListBackAsItWas', async () => {
    renderList('/app/short-rent/crm/guests?q=rossi&channel=Airbnb&sort=spend&page=2');
    await findTable();

    fireEvent.click(screen.getByTestId('crm-filters-clear'));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/app\/short-rent\/crm\/guests\?sort=spend$/));
    expect(screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') })).toHaveValue('');
  });

  it('GuestList_NoGuestYet_SaysProfilesArriveWithTheBookings', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([]));

    renderList();

    expect(await screen.findByText(i18n.t('crm.list.empty.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('crm.list.empty.description'))).toBeInTheDocument();
  });

  it('GuestList_NoProfileMatches_SaysSoAndOffersToClearTheFilters', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([]));

    renderList('/app/short-rent/crm/guests?tag=nessuno');

    expect(await screen.findByText(i18n.t('crm.list.noMatch.title'))).toBeInTheDocument();
    // The way out is also in the empty state itself, not only in the bar of the filters.
    fireEvent.click(within(screen.getByTestId('crm-profiles')).getByRole('button', { name: i18n.t('crm.list.noMatch.action') }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/app\/short-rent\/crm\/guests$/));
  });

  it('GuestList_TheLoadFails_ExplainsItAndOffersARetry', async () => {
    vi.mocked(CrmApi.getGuests).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(page([profile()]));

    renderList();

    expect(await screen.findByText(i18n.t('crm.list.loadError'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(await findTable()).toBeInTheDocument();
  });

  it('GuestList_MoreThanAPage_PagesTwentyAtATimeThroughTheAddress', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile()], 45));

    renderList();
    await findTable();
    expect(screen.getByTestId('crm-count')).toHaveTextContent('45 profili');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('listView.pagination.next') }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('?page=2'));
    await waitFor(() => expect(lastAsked()).toMatchObject({ page: 2, pageSize: 20 }));
  });

  it('GuestList_APageThatIsNotThereAnyMore_GoesToTheLastOne', async () => {
    vi.mocked(CrmApi.getGuests).mockImplementation(async (params) => (params?.page === 3 ? page([profile()], 45, 3) : page([], 45, params?.page ?? 1)));

    renderList('/app/short-rent/crm/guests?page=9');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('?page=3'));
    expect(await findTable()).toBeInTheDocument();
  });
});
