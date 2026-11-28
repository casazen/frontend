import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { campaignsApi } from '@/api/campaigns.api';
import { CrmApi } from '@/api/crm.api';
import type { CrmProfileList, CrmProfileListItem } from '@/types/crm.types';
import GuestList from '../GuestList';

vi.mock('@/api/crm.api', () => ({
  CrmApi: { getGuests: vi.fn() },
}));
vi.mock('@/api/campaigns.api', () => ({
  campaignsApi: { getSegments: vi.fn(), getCampaigns: vi.fn() },
}));
const permissions = vi.hoisted(() => ({ canWrite: true, canMarket: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (_context: string, permission: string) => {
      if (permission === 'guest.write') return permissions.canWrite;
      if (permission === 'marketing.manage') return permissions.canMarket;
      return true;
    },
  }),
}));
interface HeaderAction {
  label: string;
  to?: string;
  testId?: string;
}
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description, primary, secondary }: { title: string; description?: string; primary?: HeaderAction; secondary?: Array<HeaderAction | { separator: true }> }) =>
    createElement(
      'div',
      null,
      createElement('h1', null, title),
      description ? createElement('p', null, description) : null,
      primary ? createElement('a', { href: primary.to, 'data-testid': primary.testId }, primary.label) : null,
      ...(secondary ?? []).map((item) => ('label' in item ? createElement('a', { key: item.label, href: item.to, 'data-testid': item.testId }, item.label) : null)),
    ),
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
const overviewAsked = () => vi.mocked(CrmApi.getGuests).mock.calls.map(([params]) => params).filter((params) => params?.pageSize === 1);
const lastAsked = () => vi.mocked(CrmApi.getGuests).mock.calls.map(([params]) => params).filter((params) => params?.pageSize !== 1).at(-1);

describe('GuestList: the CRM profiles of the host (E07/F01/US04/T01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    permissions.canWrite = true;
    permissions.canMarket = true;
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile()]));
    vi.mocked(campaignsApi.getSegments).mockResolvedValue([{ id: 'segment-1' }] as never);
    vi.mocked(campaignsApi.getCampaigns).mockResolvedValue([{ id: 'campaign-1', status: 'Sent' }] as never);
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('GuestList_Opens_ShowsTheProfileWithItsFiguresChannelsTagsAndEmailState', async () => {
    renderList();

    const table = within(await findTable());
    expect(table.getByRole('rowheader', { name: /Mario Rossi/ })).toBeInTheDocument();
    expect(table.getByText('3 soggiorni')).toBeInTheDocument();
    // Italian groups the thousands from five digits on, English from four: either way the amount is there, in euro.
    expect(table.getByText(/1\.?240,00/)).toBeInTheDocument();
    expect(table.getByText('14 set 2026')).toBeInTheDocument();
    expect(table.getByText('Sito diretto')).toBeInTheDocument();
    expect(table.getByText('Airbnb')).toBeInTheDocument();
    expect(table.getByText('vip')).toBeInTheDocument();
    expect(table.getByTestId('contact-state-badge')).toHaveAttribute('data-state', 'consent');
    expect(table.getByText('m***@example.it')).toBeInTheDocument();
    expect(CrmApi.getGuests).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20, sort: 'lastStay' }));
  });

  it('GuestList_Opens_NeverShowsNorAsksForADocumentABirthDateOrABirthPlace', async () => {
    renderList('/app/short-rent/crm/guests?country=IT');

    await findTable();
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
    expect(mark.getAttribute('title')).toMatch(/schede doppie/);
  });

  it('GuestList_TheMarkOfAProposal_DoesNotSendWhoMayOnlyReadToAPageTheyCannotOpen', async () => {
    permissions.canWrite = false;
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile({ hasMergeProposal: true })]));

    renderList();

    const mark = within(await findTable()).getByTestId('crm-merge-mark');
    expect(mark).toHaveAttribute('title', i18n.t('crm.list.mergeProposalHintReadOnly'));
    expect(mark.getAttribute('title')).not.toMatch(/doppie/);
    expect(within(mark).queryByRole('link')).not.toBeInTheDocument();
  });

  it.each(['it', 'en'])('GuestList_TheTwoHintsOfTheMark_ExistInBothLanguagesAndOnlyTheFirstNamesTheDuplicates (%s)', async (language) => {
    await i18n.changeLanguage(language);

    const decide = i18n.t('crm.list.mergeProposalHint');
    const readOnly = i18n.t('crm.list.mergeProposalHintReadOnly');

    expect(readOnly).not.toBe('crm.list.mergeProposalHintReadOnly');
    expect(readOnly).not.toBe(decide);
    const namesThePage = language === 'it' ? /schede doppie/i : /duplicate cards/i;
    expect(decide).toMatch(namesThePage);
    expect(readOnly).not.toMatch(namesThePage);
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
    expect(box).toHaveValue('mario ');
  });

  it.each(['mario.rossi@example.it', '+39 333 1234567'])('GuestList_ASearchBy_%s_GoesToTheServerAndNeverToTheAddress', async (text) => {
    renderList('/app/short-rent/crm/guests?sort=spend');
    await findTable();
    const box = screen.getByRole('searchbox', { name: i18n.t('crm.filters.search.label') });

    fireEvent.change(box, { target: { value: text } });

    await waitFor(() => expect(lastAsked()).toMatchObject({ search: text, page: 1, sort: 'spend' }));
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

  it('GuestList_NoGuestYet_SaysHowGuestsArriveAndOffersTheImportAndTheHelp', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([]));

    renderList();

    expect(await screen.findByText(i18n.t('crm.list.empty.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('crm.list.empty.description'))).toBeInTheDocument();
    const empty = within(screen.getByTestId('crm-empty'));
    expect(empty.getByRole('link', { name: i18n.t('crm.list.empty.import') })).toHaveAttribute('href', '/app/short-rent/crm/segments?import=1');
    expect(empty.getByRole('link', { name: i18n.t('crm.list.empty.help') })).toHaveAttribute('href', '/app/short-rent/help#guide-guests');
    // Nothing to search in yet: no filters, no numbers, no next step.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-next-step')).not.toBeInTheDocument();
  });

  it('GuestList_NoGuestYetAndNoPermissionToMarket_OffersNoImport', async () => {
    permissions.canMarket = false;
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([]));

    renderList();

    const empty = within(await screen.findByTestId('crm-empty'));
    expect(empty.queryByRole('link', { name: i18n.t('crm.list.empty.import') })).not.toBeInTheDocument();
    expect(empty.getByRole('link', { name: i18n.t('crm.list.empty.help') })).toBeInTheDocument();
  });

  it('GuestList_NoProfileMatches_SaysSoAndOffersToClearTheFilters', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([]));

    renderList('/app/short-rent/crm/guests?tag=nessuno');

    expect(await screen.findByText(i18n.t('crm.list.noMatch.title'))).toBeInTheDocument();
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
    expect(screen.getByTestId('crm-count')).toHaveTextContent('45 ospiti');

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

  it('GuestList_ARow_HasTheFaceOfTheGuest_AndALeadWithoutANameHasTheIconOfAPerson', async () => {
    vi.mocked(CrmApi.getGuests).mockResolvedValue(page([profile(), profile({ id: LEAD, displayName: '', emailMasked: 'l***@example.it', totalStays: 0 })]));

    renderList();

    const table = within(await findTable());
    const [named, lead] = table.getAllByTestId('crm-avatar');
    expect(named).toHaveTextContent('MR');
    expect(named).toHaveAttribute('aria-hidden', 'true');
    expect(lead.querySelector('svg')).not.toBeNull();
    expect(table.getByText(i18n.t('crm.list.noStays'))).toBeInTheDocument();
  });

  it('GuestList_WhoMayMarket_FindsTheCampaignTheGroupAndTheImportInTheHead', async () => {
    renderList();
    await findTable();

    expect(screen.getByTestId('crm-new-campaign')).toHaveAttribute('href', '/app/short-rent/crm/campaigns?new=1');
    expect(screen.getByTestId('crm-new-group')).toHaveAttribute('href', '/app/short-rent/crm/segments?new=1');
    expect(screen.getByTestId('crm-import')).toHaveAttribute('href', '/app/short-rent/crm/segments?import=1');
  });

  it('GuestList_WhoMayNotMarket_HasNoActionNoNextStepAndAsksNothingOfTheCampaigns', async () => {
    permissions.canMarket = false;
    vi.mocked(campaignsApi.getSegments).mockResolvedValue([]);

    renderList();
    await findTable();

    expect(screen.queryByTestId('crm-new-campaign')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-new-group')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-import')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-next-step')).not.toBeInTheDocument();
    expect(campaignsApi.getSegments).not.toHaveBeenCalled();
    expect(campaignsApi.getCampaigns).not.toHaveBeenCalled();
  });

  it('GuestList_TheStrip_CountsAllTheGuestsWhateverTheFiltersAreOnScreen', async () => {
    vi.mocked(CrmApi.getGuests).mockImplementation(async (params) => {
      if (params?.pageSize !== 1) return page([profile()], 3);
      if (params.reachableByEmail) return page([], 25);
      if (params.minStays === 3) return page([], 6);
      if (params.minStays === 2) return page([], 14);
      return page([], 40);
    });

    renderList('/app/short-rent/crm/guests?country=IT');

    const strip = await screen.findByTestId('crm-overview');
    expect(strip).toHaveTextContent(/Ospiti\s*40/);
    expect(strip).toHaveTextContent(/Raggiungibili via e-mail\s*25/);
    expect(strip).toHaveTextContent(/Tornati almeno una volta\s*14/);
    expect(strip).toHaveTextContent(/Fedeli \(3\+ soggiorni\)\s*6/);
    expect(overviewAsked()).toHaveLength(4);
    expect(overviewAsked()).toEqual(
      expect.arrayContaining([
        { page: 1, pageSize: 1 },
        { reachableByEmail: true, page: 1, pageSize: 1 },
        { minStays: 2, page: 1, pageSize: 1 },
        { minStays: 3, page: 1, pageSize: 1 },
      ]),
    );
  });

  it('GuestList_OneOfTheFourNumbersFails_LeavesTheStripOutAndKeepsTheList', async () => {
    vi.mocked(CrmApi.getGuests).mockImplementation(async (params) => {
      if (params?.minStays === 3) throw new Error('boom');
      return page([profile()]);
    });

    renderList();

    expect(await findTable()).toBeInTheDocument();
    await waitFor(() => expect(overviewAsked()).toHaveLength(4));
    expect(screen.queryByTestId('crm-overview')).not.toBeInTheDocument();
  });

  it('GuestList_NoGroupYet_AsksForTheFirstGroupAsTheOnlyNextStep', async () => {
    vi.mocked(campaignsApi.getSegments).mockResolvedValue([]);
    vi.mocked(campaignsApi.getCampaigns).mockResolvedValue([]);

    renderList();

    const step = await screen.findByTestId('crm-next-step');
    expect(step).toHaveAttribute('data-step', 'group');
    expect(within(step).getByRole('heading', { name: i18n.t('crm.nextStep.group.title') })).toBeInTheDocument();
    expect(within(step).getByRole('link', { name: i18n.t('crm.nextStep.group.cta') })).toHaveAttribute('href', '/app/short-rent/crm/segments?new=1');
    expect(screen.getAllByTestId('crm-next-step')).toHaveLength(1);
  });

  it('GuestList_GroupsButNoCampaign_AsksForTheFirstCampaign', async () => {
    vi.mocked(campaignsApi.getCampaigns).mockResolvedValue([]);

    renderList();

    const step = await screen.findByTestId('crm-next-step');
    expect(step).toHaveAttribute('data-step', 'campaign');
    expect(within(step).getByRole('link', { name: i18n.t('crm.nextStep.campaign.cta') })).toHaveAttribute('href', '/app/short-rent/crm/campaigns?new=1');
  });

  it('GuestList_GroupsAndCampaignsDone_ShowsNoNextStep', async () => {
    renderList();

    expect(await findTable()).toBeInTheDocument();
    await waitFor(() => expect(campaignsApi.getCampaigns).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('crm-overview')).toBeInTheDocument());
    expect(screen.queryByTestId('crm-next-step')).not.toBeInTheDocument();
  });
});
