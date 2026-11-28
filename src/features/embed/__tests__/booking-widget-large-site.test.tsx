import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import type { EmbedMessage } from '@/embed/protocol';
import type { RegionMapProps } from '@/features/site-maps';
import { freezeClock, NOON_UTC } from '@/test/clock';
import { stubViewportWidth } from '@/test/viewport';
import type { PublicOrgDto } from '@/types';
import type { PublicStayCard, PublicStaysQuery, PublicStaysResult } from '@/types/public-stays.types';
import { FRAME_QUERY, frameInsideAPage, renderWidgets, type FramingPage } from './embed-test-kit';
import { DESTINATIONS, ORG_SLUG, siteCalendar, stayCard, staysResult } from './stays-fixtures';

vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getPublicOrg: vi.fn(), getOrgProperty: vi.fn(() => new Promise(() => undefined)) } }));
vi.mock('@/api/public-site-search.api', () => ({
  publicSiteSearchApi: { getStays: vi.fn(), getSiteCalendar: vi.fn(), getDestinations: vi.fn() },
}));

const map = vi.hoisted(() => ({ props: null as RegionMapProps | null }));
vi.mock('@/features/site-maps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/site-maps')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    RegionMap: (props: RegionMapProps) => {
      map.props = props;
      return createElement('div', { 'data-testid': 'region-map-stub', 'data-pins': String(props.pins.length) });
    },
  };
});

const ORG: PublicOrgDto = { slug: ORG_SLUG, displayName: 'Villa Rossi', logoUrl: null, themeColor: null, contactEmail: null };
const getPublicOrg = vi.mocked(publicOrgApi.getPublicOrg);
const getStays = vi.mocked(publicSiteSearchApi.getStays);
const DATES = 'checkin=2026-12-10&checkout=2026-12-13&guests=2';

function site(count: number, free = count): PublicStaysResult {
  const homes: PublicStayCard[] = Array.from({ length: count }, (_, index) => {
    const card = stayCard(index + 1);
    return {
      ...card,
      price: { ...card.price, totalCents: card.price.perNightCents * 3 },
      availability: index < free ? { available: true } : { available: false, reason: 'busy', firstFreeCheckIn: '2026-12-20' },
    };
  });
  return staysResult(homes, { checkIn: '2026-12-10', checkOut: '2026-12-13', nights: 3 });
}

let page: FramingPage;

function open(search = DATES) {
  return renderWidgets(`/embed/${ORG_SLUG}/booking?${search}&${FRAME_QUERY}`);
}

const cards = () => screen.queryAllByTestId('house-card');
const showMore = () => screen.getByRole('button', { name: 'Mostra altre case' });
const lists = () => page.sent('event').filter((message): message is EmbedMessage<'event'> => message.type === 'event' && message.name === 'view_item_list');

// The routes load the shell and the widget when they are first needed: here they are loaded before the first test, so that none of them has to wait for it.
beforeAll(async () => {
  await Promise.all([import('../embed-shell'), import('../booking-widget')]);
}, 120_000);

beforeEach(async () => {
  freezeClock(NOON_UTC);
  stubViewportWidth(1280);
  getPublicOrg.mockReset().mockResolvedValue(ORG);
  getStays.mockReset().mockResolvedValue(site(200));
  vi.mocked(publicSiteSearchApi.getSiteCalendar).mockReset().mockResolvedValue(siteCalendar('2026-09-24'));
  vi.mocked(publicSiteSearchApi.getDestinations).mockReset().mockResolvedValue(DESTINATIONS);
  map.props = null;
  page = frameInsideAPage();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  page.restore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('200 homes in one frame (AC4)', () => {
  it('embedBookingLargeSite_TwoHundredHomes_ShowsTwentyFourCards_TheMapKeepsEveryPin_AndTheTitleTheRealCount', async () => {
    open();

    await screen.findAllByTestId('house-card');
    expect(cards()).toHaveLength(24);
    expect(within(screen.getByTestId('search-results')).getAllByTestId('house-card')).toHaveLength(24);
    expect(screen.getByTestId('region-map-stub')).toHaveAttribute('data-pins', '200');
    expect(map.props?.pins).toHaveLength(200);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('200 case libere');
    expect(screen.getByText('Stai vedendo 24 case su 200')).toBeInTheDocument();
  });

  it('embedBookingLargeSite_ShowMoreHomes_AddsTwentyFourAtATime_FromTheSameAnswerWithNoNewRequest', async () => {
    getStays.mockResolvedValue(site(60));
    open();
    await screen.findAllByTestId('house-card');
    expect(cards()).toHaveLength(24);
    const asked = getStays.mock.calls.length;

    fireEvent.click(showMore());
    expect(cards()).toHaveLength(48);
    expect(screen.getByText('Stai vedendo 48 case su 60')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getAllByTestId('house-card-link')[24]);

    fireEvent.click(showMore());
    expect(cards()).toHaveLength(60);
    expect(screen.queryByRole('button', { name: 'Mostra altre case' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-more')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getAllByTestId('house-card-link')[48]);

    expect(getStays.mock.calls.length).toBe(asked);
    expect(map.props?.pins).toHaveLength(60);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('60 case libere');
  });

  it('embedBookingLargeSite_ViewItemList_CarriesTwentyItems_AndShowingMoreHomesSaysNothingAgain', async () => {
    open();
    await screen.findAllByTestId('house-card');

    await waitFor(() => expect(lists()).toHaveLength(1));
    const items = lists()[0].params.items as { item_id: string; index: number }[];
    expect(items).toHaveLength(20);
    expect(items.map((item) => item.item_id)).toEqual(Array.from({ length: 20 }, (_, index) => `home-${String(index + 1).padStart(3, '0')}`));
    expect(items[19].index).toBe(19);

    fireEvent.click(showMore());
    expect(cards()).toHaveLength(48);
    expect(lists()).toHaveLength(1);
  });

  it('embedBookingLargeSite_AnotherList_StartsAgainFromTheFirstTwentyFour', async () => {
    getStays.mockImplementation((_slug: string, query?: PublicStaysQuery) =>
      Promise.resolve(query?.sort === 'priceAsc' ? { ...site(200), items: [...site(200).items].reverse() } : site(200)),
    );
    open();
    await screen.findAllByTestId('house-card');
    fireEvent.click(showMore());
    expect(cards()).toHaveLength(48);

    fireEvent.change(screen.getByTestId('search-sort'), { target: { value: 'priceAsc' } });

    await waitFor(() => expect(screen.getAllByTestId('house-card-link')[0]).toHaveTextContent('Casa 200'));
    expect(cards()).toHaveLength(24);
    expect(screen.getByText('Stai vedendo 24 case su 200')).toBeInTheDocument();
  });

  it('embedBookingLargeSite_AFewHomesNotFree_AreAfterTheOnesThatAre_AndTheMapKeepsThemToo', async () => {
    getStays.mockResolvedValue(site(200, 190));
    open();

    await screen.findAllByTestId('house-card');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('190 case libere');
    expect(cards()).toHaveLength(24);
    expect(screen.getByText('Stai vedendo 24 case su 190')).toBeInTheDocument();
    expect(within(screen.getByTestId('search-unavailable')).getAllByRole('link')).toHaveLength(10);
    expect(map.props?.pins).toHaveLength(200);
    expect(map.props?.pins.filter((pin) => pin.available === false)).toHaveLength(10);
  });

  it('embedBookingLargeSite_UnderTheLimit_HasNoButtonAndNoLine', async () => {
    getStays.mockResolvedValue(site(24));
    open();

    await screen.findAllByTestId('house-card');
    expect(cards()).toHaveLength(24);
    expect(screen.queryByTestId('search-more')).not.toBeInTheDocument();
  });
});
