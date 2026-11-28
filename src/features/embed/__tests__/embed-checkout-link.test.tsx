import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { buildEmbedMessage, type EmbedMessage } from '@/embed/protocol';
import { BookingContext, type BookingModel, type QuoteView } from '@/features/public-booking/booking/booking-context';
import type { DirectBookingQuote, PublicPropertyDetailDto } from '@/types';
import { EmbedCheckoutLink } from '../embed-checkout-link';
import { EmbedContext, type EmbedContextValue } from '../embed-context';
import { EmbedBridgeContext, type EmbedBridge } from '../use-embed-bridge';

/**
 * «Prenota» of the property widget (E41/F01/US02/T02, NF-144): the ONE way out to the checkout. What costs something when it is wrong is the exit itself (only to the
 * checkout of the own origin, taking the whole page, never a payment inside a frame) and the money it tells the page (the total of the quote of the server, in the currency
 * of the quote).
 */
const PARENT = 'https://quokka360.com';

const property = {
  id: '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b',
  slug: 'casa-mare',
  name: 'Casa Mare',
  city: 'Lugano',
  currency: 'CHF',
} as PublicPropertyDetailDto;

const quote = {
  propertyId: property.id,
  currency: 'CHF',
  totalPrice: 519.5,
  lines: [
    { kind: 'Nights', quantity: 3, unitAmountCents: 15000, amountCents: 45000 },
    { kind: 'Total', quantity: null, unitAmountCents: null, amountCents: 51950 },
  ],
} as unknown as DirectBookingQuote;

const STAY = { checkIn: '2026-12-01', checkOut: '2026-12-05', adults: 2, children: 1, pets: true };

function embedOf(overrides: Partial<EmbedContextValue> = {}): EmbedContextValue {
  return { widget: 'property', orgSlug: 'villa-rossi', embedBase: '/embed/villa-rossi', parentOrigin: PARENT, lang: 'en', hostMode: 'platform', ...overrides };
}

const sent: EmbedMessage[] = [];

function bridgeOf(overrides: Partial<EmbedBridge> = {}): EmbedBridge {
  return {
    active: true,
    attached: true,
    send: {
      event: (name, params) => sent.push(buildEmbedMessage('event', { name, params })),
      navigate: (url, target) => sent.push(buildEmbedMessage('navigate', { url, target })),
      error: (code) => sent.push(buildEmbedMessage('error', { code })),
    },
    ...overrides,
  };
}

function modelOf(quoteView: QuoteView = { status: 'ready', quote, estimatedTax: false }): BookingModel {
  return { property, orgSlug: 'villa-rossi', stay: STAY, quote: quoteView } as unknown as BookingModel;
}

interface RenderOptions {
  embed?: EmbedContextValue | null;
  bridge?: EmbedBridge;
  model?: BookingModel;
  address?: string;
}

function renderLink({ embed = embedOf(), bridge = bridgeOf(), model = modelOf(), address = '/embed/villa-rossi/property/casa-mare' }: RenderOptions = {}) {
  return render(
    <MemoryRouter initialEntries={[address]}>
      <EmbedContext.Provider value={embed}>
        <EmbedBridgeContext.Provider value={bridge}>
          <BookingContext.Provider value={model}>
            <EmbedCheckoutLink className="cta" />
          </BookingContext.Provider>
        </EmbedBridgeContext.Provider>
      </EmbedContext.Provider>
    </MemoryRouter>,
  );
}

/** Clicks, and says whether the link took the click over (it called `preventDefault`). The click is stopped once seen, so that the browser of the test does not try to leave the page. */
function click(element: Element, init?: MouseEventInit): boolean {
  let takenOver = false;
  const see = (event: Event) => {
    takenOver = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', see);
  fireEvent.click(element, init);
  document.removeEventListener('click', see);
  return takenOver;
}

const link = () => screen.getByTestId('booking-cta');

beforeEach(async () => {
  sent.length = 0;
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('it');
});

describe('the address of the exit (AC2)', () => {
  it('embedCheckoutLink_url_isOnTheFrameOrigin', () => {
    renderLink();

    const url = new URL(link().getAttribute('href') ?? '');
    expect(link().tagName).toBe('A');
    expect(link()).toHaveTextContent('Book');
    expect(link()).toHaveAttribute('target', '_top');
    expect(link()).toHaveAttribute('rel', 'noopener');
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/book/villa-rossi/property/casa-mare/checkout');
    expect(url.pathname.startsWith('/embed')).toBe(false);
  });

  it('embedCheckoutLink_OnAnAgencyDomain_IsThePathOfTheSiteWithNoBook', () => {
    renderLink({ embed: embedOf({ hostMode: 'host', embedBase: '/embed' }) });

    expect(new URL(link().getAttribute('href') ?? '').pathname).toBe('/property/casa-mare/checkout');
  });

  it('embedCheckoutLink_url_CarriesTheStayTheLanguageAndWhereTheGuestCameFrom_AndNothingElse', () => {
    renderLink({ address: '/embed/villa-rossi/property/casa-mare?checkin=2026-01-01&email=mario%40rossi.it&token=gs1.x&utm_campaign=Estate-2026&utm_source=other&utm_medium=other' });

    expect(Object.fromEntries(new URL(link().getAttribute('href') ?? '').searchParams)).toEqual({
      checkin: '2026-12-01',
      checkout: '2026-12-05',
      guests: '3',
      children: '1',
      pets: '1',
      lang: 'en',
      utm_source: 'agency-site',
      utm_medium: 'embed',
      utm_campaign: 'estate-2026',
    });
  });

  it('embedCheckoutLink_ACampaignThatIsNotAPlainName_NeverGoesOn', () => {
    renderLink({ address: '/embed/villa-rossi/property/casa-mare?utm_campaign=mario.rossi%40example.com' });

    expect(new URL(link().getAttribute('href') ?? '').searchParams.has('utm_campaign')).toBe(false);
  });
});

describe('the click (AC3)', () => {
  it('embedCheckoutLink_WithTheLoaderAttached_TellsBeginCheckoutThenAsksThePageToTakeTheWholeWindow_AndTakesTheClickOver', () => {
    renderLink();

    const takenOver = click(link());

    expect(takenOver).toBe(true);
    expect(sent.map((message) => message.type)).toEqual(['event', 'navigate']);
    const [begin, go] = sent as [EmbedMessage<'event'>, EmbedMessage<'navigate'>];
    expect(begin.name).toBe('begin_checkout');
    expect(begin.params).toEqual({
      currency: 'CHF',
      value: 519.5,
      items: [{ item_id: property.id, item_name: 'Casa Mare', item_category: 'Lugano', price: 519.5, quantity: 1 }],
    });
    expect(go.target).toBe('top');
    expect(go.url).toBe(link().getAttribute('href'));
  });

  it.each([
    ['no loader attached', { attached: false }],
    ['no page that frames the widget', { active: false, attached: false }],
  ])('embedCheckoutLink_With%s_LeavesTheClickToTheLinkAndSaysNothing', (_label, bridge) => {
    renderLink({ bridge: bridgeOf(bridge) });

    expect(click(link())).toBe(false);
    expect(sent).toEqual([]);
  });

  it.each([
    ['control', { ctrlKey: true }],
    ['command', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['the middle button', { button: 1 }],
  ])('embedCheckoutLink_AClickWith_%s_IsLeftToTheBrowser', (_label, init) => {
    renderLink();

    expect(click(link(), init)).toBe(false);
    expect(sent).toEqual([]);
  });

  it('embedCheckoutLink_TheCurrencyIsTheOneOfTheQuote_AndFallsBackToTheOneOfTheHome_NeverToAFixedOne', () => {
    renderLink({ model: modelOf({ status: 'ready', quote: { ...quote, currency: '' } as DirectBookingQuote, estimatedTax: false }) });

    click(link());

    expect((sent[0] as EmbedMessage<'event'>).params.currency).toBe('CHF');
  });

  it('embedCheckoutLink_WhatItTellsThePage_HasNothingOfTheGuest', () => {
    renderLink({ address: '/embed/villa-rossi/property/casa-mare?email=mario%40rossi.it&phone=%2B393331234567&code=ABCDE-12345&token=gs1.secret' });

    click(link());

    const said = JSON.stringify(sent);
    for (const secret of ['mario', 'rossi.it', '393331234567', 'ABCDE-12345', 'gs1.secret', 'email', 'phone', 'token']) expect(said).not.toContain(secret);
  });
});

describe('when there is no exit (AC1, AC3)', () => {
  it.each([
    ['the quote is on its way', { status: 'loading', stale: null }],
    ['no stay is chosen', { status: 'none' }],
    ['the stay cannot be had', { status: 'problem', problem: 'busy' }],
    ['the quote failed', { status: 'error', message: 'x', retry: () => undefined }],
  ] as [string, QuoteView][])('embedCheckoutLink_When_%s_RendersNoLink', (_label, view) => {
    renderLink({ model: modelOf(view) });

    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
  });

  it('embedCheckoutLink_OutsideAFrame_RendersNoLink', () => {
    renderLink({ embed: null });

    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
  });
});
