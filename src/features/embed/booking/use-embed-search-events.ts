import { useCallback, useEffect, useRef } from 'react';
import { useEmbed } from '@/features/embed/embed-context';
import { useEmbedBridge } from '@/features/embed/use-embed-bridge';
import type { StayState } from '@/features/public-site/stay/stay-state';
import { searchEvent, viewItemListEvent, type Ga4SearchEvent } from '@/lib/ga4-ecommerce';
import type { PublicDestination, PublicStayCard } from '@/types/public-stays.types';

export const EMBED_RESULTS_LIST_ID = 'search_results';

const EMBED_RESULTS_LIST_NAME = 'Search results';

interface EmbedSearchEventsInput {
  cards: readonly PublicStayCard[];
  settled: boolean;
  destinations: readonly PublicDestination[] | undefined;
}

/**
 * What the booking widget tells the page that frames it about the search (NF-144, NF-145; the page forwards it to its `dataLayer` as GA4 events):
 *
 * - `view_item_list`, with the first 20 homes of the list (`ga4-ecommerce`), once for each distinct result set: the key is the ids of the homes in the order the
 *   list shows them, so a refetch of the same homes, or a change of the address that leaves the same list, says nothing again. Never while the answer is on its
 *   way, never with no home to list, and never without a page to tell (`bridge.active`): the widget opened on its own sends nothing.
 * - `search`, when the guest sends the bar (`reportSearch`): the place by its name, the dates and the number of guests, and nothing else, so no personal data can
 *   be in it. The same search twice in a row is told once; one that is sent while the answer is on its way waits for it.
 *
 * Outside the frame of a widget (the booking site itself) it does nothing.
 */
export function useEmbedSearchEvents({ cards, settled, destinations }: EmbedSearchEventsInput) {
  const embed = useEmbed();
  const { active, send } = useEmbedBridge();
  const live = embed !== null && active;

  const listedKey = useRef<string | null>(null);
  const lastSearch = useRef<string | null>(null);
  const waiting = useRef<Ga4SearchEvent | null>(null);

  const tell = useCallback(
    (event: Ga4SearchEvent) => {
      const key = JSON.stringify(event);
      if (lastSearch.current === key) return;
      lastSearch.current = key;
      send.event('search', { ...event });
    },
    [send],
  );

  const resultKey = cards.map((card) => card.id).join(',');
  useEffect(() => {
    if (!live || !settled) return;

    if (waiting.current) {
      tell(waiting.current);
      waiting.current = null;
    }
    if (cards.length === 0) {
      listedKey.current = null;
      return;
    }
    if (listedKey.current === resultKey) return;
    listedKey.current = resultKey;
    send.event('view_item_list', { ...viewItemListEvent(cards, { listId: EMBED_RESULTS_LIST_ID, listName: EMBED_RESULTS_LIST_NAME }) });
  }, [live, settled, cards, resultKey, send, tell]);

  const reportSearch = useCallback(
    ({ stay, where }: { stay: StayState; where: string }) => {
      if (!live) return;
      const place = where ? destinations?.find((destination) => destination.id === where) : undefined;
      const event = searchEvent({ term: place?.label, checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.adults + stay.children });
      if (settled) tell(event);
      else waiting.current = event;
    },
    [live, settled, destinations, tell],
  );

  return { reportSearch };
}
