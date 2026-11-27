import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/** Homes the list shows at first, and the ones each press of «Show more homes» adds. */
export const EMBED_RESULTS_PAGE_SIZE = 24;

interface EmbedSearchResultsProps<T extends { id: string }> {
  /** Every home of the answer that the list shows (the free ones), in order: the whole list, never a page of it. */
  cards: readonly T[];
  renderCard: (card: T, index: number) => ReactNode;
}

/**
 * The cards of the results inside the frame of the booking widget (NF-144). A booking site lists every home of an org in one go, which is right for a
 * page that scrolls; a frame is as tall as its content, and 190 homes with their photos are tens of thousands of pixels. So the list shows the first 24 and a
 * button that adds 24 at a time. It is all on the client, from the same answer (no new request): the count in the title, the map and its pins are those of
 * the whole answer. A different list (a new search, a filter, another order) starts again from the first 24.
 *
 * The focus goes to the first card the button added, so that a keyboard or a screen reader follows the list when it grows (and does not fall to the top of
 * the page when the last press takes the button away). It does not scroll: the page that frames the widget keeps its own place.
 */
export function EmbedSearchResults<T extends { id: string }>({ cards, renderCard }: EmbedSearchResultsProps<T>) {
  const { t } = useTranslation();
  const list = useRef<HTMLDivElement>(null);
  // The answer the count belongs to: when the list changes, the count is the first page again (derived while drawing, no effect).
  const listKey = cards.map((card) => card.id).join(',');
  const [asked, setAsked] = useState({ listKey, count: EMBED_RESULTS_PAGE_SIZE });
  const count = asked.listKey === listKey ? asked.count : EMBED_RESULTS_PAGE_SIZE;
  const shown = Math.min(count, cards.length);
  const addedFrom = useRef<number | null>(null);

  useEffect(() => {
    const from = addedFrom.current;
    if (from === null) return;
    addedFrom.current = null;
    list.current?.querySelectorAll<HTMLElement>('[data-testid="house-card-link"]')[from]?.focus({ preventScroll: true });
  }, [shown]);

  const more = () => {
    addedFrom.current = shown;
    setAsked({ listKey, count: shown + EMBED_RESULTS_PAGE_SIZE });
  };

  return (
    <>
      <div ref={list} className="sr-cards" data-testid="search-results">
        {cards.slice(0, shown).map((card, index) => renderCard(card, index))}
      </div>
      {shown < cards.length ? (
        <div className="sr-more" data-testid="search-more">
          <p role="status">{t('embed.booking.more.shown', { shown, total: cards.length })}</p>
          <Button type="button" variant="outline" className="public-site-outline h-11 px-5" onClick={more} data-testid="search-more-button">
            {t('embed.booking.more.button')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
