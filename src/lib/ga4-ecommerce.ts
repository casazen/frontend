/**
 * The payloads of the GA4 e-commerce events of the booking funnel (NF-144, NF-145, NF-149): `view_item_list`, `view_item`, `begin_checkout`,
 * `purchase` and the `search`. Pure functions: they build the object that goes in `ecommerce` of a `dataLayer.push({ event, ecommerce })`, and in
 * the `params` of an `event` message from a widget to the page that frames it. Nothing is pushed, sent or stored here.
 *
 * Two rules hold for all of them. MONEY: values are in major units, from cents rounded to two decimals, and the currency is always the one the data
 * came with (a home keeps its own: `CHF` stays `CHF`), never converted, never added up across homes, and never assumed: an amount without a currency
 * of the data is left out. PRIVACY: an item carries the id, the name and the place of a home, its price, quantity, position and list, and nothing
 * else; no guest, e-mail, phone or booking code can get in, because nothing but those members is ever copied from what the builders are given.
 * The only identifier of a purchase is the id of the booking, never the code the guest is shown.
 *
 * SIZE: the `params` of an `event` message are at most 4 KB (`src/embed/protocol.ts`) and a message over it is never posted, silently. The one payload that
 * can reach it is the list of homes, so `viewItemListEvent` is the one that makes sure it fits (see there).
 */
import { fitsEmbedEventParams } from '@/embed/protocol';

const MAX_LIST_ITEMS = 20;

const MAX_SEARCH_TERM_LENGTH = 100;

export interface Ga4Item {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_list_id?: string;
  item_list_name?: string;
  index?: number;
  price?: number;
  quantity: number;
}

interface Ga4ItemInput {
  id: string;
  name: string;
  place?: string | null;
  price?: number | null;
  quantity?: number;
  index?: number;
  listId?: string;
  listName?: string;
}

function money(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : undefined;
}

function majorUnits(cents: number | null | undefined): number | undefined {
  return typeof cents === 'number' && Number.isFinite(cents) ? money(Math.round(cents) / 100) : undefined;
}

function currencyOf(code: string | null | undefined): string | undefined {
  const normalized = code?.trim().toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

export function ga4Item({ id, name, place, price, quantity = 1, index, listId, listName }: Ga4ItemInput): Ga4Item {
  const item: Ga4Item = { item_id: id, item_name: name, quantity };
  const where = place?.trim();
  if (where) item.item_category = where;
  if (listId) item.item_list_id = listId;
  if (listName) item.item_list_name = listName;
  if (index !== undefined) item.index = index;
  const amount = money(price);
  if (amount !== undefined) item.price = amount;
  return item;
}

interface Ga4Card {
  id: string;
  name: string;
  comune?: string | null;
  price?: { currency?: string | null; totalCents?: number | null } | null;
}

export interface Ga4ListEvent {
  item_list_id: string;
  item_list_name: string;
  currency?: string;
  items: Ga4Item[];
}

/**
 * The event of the homes `shown` (all of them), in their order. A home with a quote for the stay carries it as its price; when the homes are priced in
 * different currencies (a list may mix `EUR` and `CHF`) no price is sent at all, because GA4 takes one currency per event and a number without its
 * currency would be a wrong one.
 */
function listEventOf(shown: readonly Ga4Card[], listId: string, listName: string): Ga4ListEvent {
  const priced = shown.filter((card) => majorUnits(card.price?.totalCents) !== undefined);
  const currencies = new Set(priced.map((card) => currencyOf(card.price?.currency)));
  const currency = currencies.size === 1 ? [...currencies][0] : undefined;

  const items = shown.map((card, index) =>
    ga4Item({
      id: card.id,
      name: card.name,
      place: card.comune,
      price: currency ? majorUnits(card.price?.totalCents) : undefined,
      index,
      listId,
      listName,
    }),
  );
  return { item_list_id: listId, item_list_name: listName, ...(currency && priced.length > 0 ? { currency } : {}), items };
}

/**
 * `view_item_list`: the first 20 homes of a list of results, with their position (`index`, from 0), and fewer when the message that carries them would
 * not fit. The `params` of an `event` message are at most 4 KB (`fitsEmbedEventParams`) and a bigger message is never posted, so a page of 20 homes with
 * the ids (36 characters) and the names a site really has, each with its place, price and list, is over it (about 4.6 KB) and the page would hear nothing
 * of the list. The homes that do not fit are left out from the END, and the currency and the prices are those of the homes that stay (a list that
 * mixes currencies only in the homes left out is a list of one currency).
 *
 * A push to the `dataLayer` of the page itself (the agency's own pages: `asEmbedMessage: false`) is no message of the protocol and has no such limit: the first 20
 * homes go, whatever their size.
 */
export function viewItemListEvent(
  cards: readonly Ga4Card[],
  { listId, listName }: { listId: string; listName: string },
  { asEmbedMessage = true }: { asEmbedMessage?: boolean } = {},
): Ga4ListEvent {
  const wanted = cards.slice(0, MAX_LIST_ITEMS);
  if (!asEmbedMessage) return listEventOf(wanted, listId, listName);

  for (let count = wanted.length; count > 0; count -= 1) {
    const event = listEventOf(wanted.slice(0, count), listId, listName);
    if (fitsEmbedEventParams(event)) return event;
  }
  return listEventOf([], listId, listName);
}

interface Ga4PropertyInput {
  propertyId: string;
  propertyName: string;
  place?: string | null;
  currency?: string | null;
  total?: number | null;
}

export interface Ga4MoneyEvent {
  currency?: string;
  value?: number;
  items: Ga4Item[];
}

function moneyOf({ currency, total }: Pick<Ga4PropertyInput, 'currency' | 'total'>): { currency?: string; value?: number } {
  const code = currencyOf(currency);
  const value = money(total);
  return code && value !== undefined ? { currency: code, value } : {};
}

export function viewItemEvent(input: Ga4PropertyInput): Ga4MoneyEvent {
  const money_ = moneyOf(input);
  return { ...money_, items: [ga4Item({ id: input.propertyId, name: input.propertyName, place: input.place, price: money_.value })] };
}

export function beginCheckoutEvent(input: Ga4PropertyInput): Ga4MoneyEvent {
  return viewItemEvent(input);
}

export interface Ga4PurchaseEvent extends Ga4MoneyEvent {
  transaction_id: string;
}

export function purchaseEvent({ bookingId, currency, total, propertyId, propertyName }: { bookingId: string; currency?: string | null; total?: number | null; propertyId: string; propertyName: string }): Ga4PurchaseEvent {
  return { transaction_id: bookingId, ...viewItemEvent({ propertyId, propertyName, currency, total }) };
}

export interface Ga4SearchEvent {
  search_term?: string;
  start_date?: string;
  end_date?: string;
  number_of_travelers?: number;
}

const NOT_A_PLACE = /@|\+?\d[\d\s().-]{5,}\d/;
const STAY_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function searchEvent({ term, checkIn, checkOut, guests }: { term?: string | null; checkIn?: string | null; checkOut?: string | null; guests?: number | null }): Ga4SearchEvent {
  const event: Ga4SearchEvent = {};
  const text = term?.replace(/\s+/g, ' ').trim();
  if (text && text.length <= MAX_SEARCH_TERM_LENGTH && !NOT_A_PLACE.test(text)) event.search_term = text;
  if (checkIn && STAY_DATE.test(checkIn)) event.start_date = checkIn;
  if (checkOut && STAY_DATE.test(checkOut)) event.end_date = checkOut;
  if (typeof guests === 'number' && Number.isInteger(guests) && guests >= 1 && guests <= 99) event.number_of_travelers = guests;
  return event;
}
