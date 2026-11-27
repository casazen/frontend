import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { availabilityNote, useCardLink } from '@/features/public-site/cards/house-card-model';
import type { StayState } from '@/features/public-site/stay/stay-state';
import { siteLocale } from '@/lib/site-language';
import type { PublicStayCard } from '@/types/public-stays.types';

export function UnavailableList({ cards, orgSlug, stay }: { cards: readonly PublicStayCard[]; orgSlug: string; stay: StayState }) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const linkOf = useCardLink();
  if (cards.length === 0) return null;

  return (
    <section className="sr-unav" aria-labelledby="sr-unav-title" data-testid="search-unavailable">
      <h2 id="sr-unav-title">{t('siteSearch.unavailable.title')}</h2>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <Link to={linkOf(orgSlug, card, stay)}>
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
