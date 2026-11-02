import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { availabilityNote, cardLink } from '@/features/public-site/cards/house-card-model';
import type { StayState } from '@/features/public-site/stay/stay-state';
import { siteLocale } from '@/lib/site-language';
import type { PublicStayCard } from '@/types/public-stays.types';

/**
 * The homes that are not free for the stay (DB-07c), after the ones that are: a short list, one line each, with the reason and what
 * to do about it («Libera dal 12 novembre», «Soggiorno minimo 3 notti», «Ospita al massimo 4 persone»), each leading to its page
 * with the same dates, where the calendar shows the free nights. Nobody is left with nothing to do.
 */
export function UnavailableList({ cards, orgSlug, stay }: { cards: readonly PublicStayCard[]; orgSlug: string; stay: StayState }) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  if (cards.length === 0) return null;

  return (
    <section className="sr-unav" aria-labelledby="sr-unav-title" data-testid="search-unavailable">
      <h2 id="sr-unav-title">{t('siteSearch.unavailable.title')}</h2>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <Link to={cardLink(orgSlug, card, stay)}>
              <span className="sr-unav__n">{card.name}</span>
              <span className="sr-unav__w">{availabilityNote(card, t, locale)}</span>
              <ChevronRight aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
