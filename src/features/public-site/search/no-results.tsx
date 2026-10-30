import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarX, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactHostDialog } from '@/features/public-site/contact/contact-host-dialog';
import { formatStayRange } from '@/features/public-site/stay/stay-format';
import { siteLocale } from '@/lib/site-language';
import type { PublicStayAlternative } from '@/types/public-stays.types';
import type { SearchScope } from './search-scope';

export type NoResultsReason = 'capacity' | 'dates' | 'filters' | 'favorites' | 'none';

interface NoResultsProps {
  reason: NoResultsReason;
  /** A site can be written to (its host); across all the sites there is no one host, so the words and the button are other. */
  scope: SearchScope;
  /** The party asked and the most guests any home of the site takes, for the sentence when the party is too big. */
  guests: number;
  maxGuests?: number;
  /** Up to three nearby ranges with free homes, from the server (the same length as the stay). */
  alternatives: readonly PublicStayAlternative[];
  /** The link that sets the dates of a nearby range (the page keeps the rest of the search). */
  alternativeHref: (alternative: PublicStayAlternative) => string;
  /** The guest has some filter on (the labels, the sheet): «Togli i filtri» shows. */
  canClearFilters: boolean;
  onClearFilters: () => void;
}

/**
 * When there is nothing to show (DB-07c): a title that says why (no home for so many guests, none free on those dates, none with
 * these filters, no heart saved), up to three nearby dates with homes that are free, a way to remove the filters in one press and
 * a way to ask the host. Never an empty page: every case has something to do next.
 */
export function NoResults({ reason, scope, guests, maxGuests, alternatives, alternativeHref, canClearFilters, onClearFilters }: NoResultsProps) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const words = scope.kind === 'org' ? 'siteSearch.none' : 'platformSearch.none';

  return (
    <div className="sr-state" data-testid="search-no-results" data-reason={reason}>
      <CalendarX aria-hidden="true" />
      <div>
        <h2>{t(`${words}.${reason}.title`, { guests })}</h2>
        <p>{t(`${words}.${reason}.text`, { count: maxGuests ?? guests, host: scope.kind === 'org' ? scope.hostName : '' })}</p>
      </div>
      {alternatives.length > 0 ? (
        <ul className="sr-alts" aria-label={t('siteSearch.none.alternatives')}>
          {alternatives.map((alternative) => (
            <li key={`${alternative.checkIn}-${alternative.checkOut}`}>
              <Link className="sr-alt" to={alternativeHref(alternative)} data-testid="search-alternative">
                <strong>{formatStayRange(alternative.checkIn, alternative.checkOut, locale)}</strong>
                <span>{t('siteSearch.none.alternativeHomes', { count: alternative.availableCount })}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="sr-state__actions">
        {canClearFilters ? (
          <Button type="button" variant="outline" className="public-site-outline h-11 px-5" onClick={onClearFilters} data-testid="search-clear-filters">
            {t('siteSearch.none.clear')}
          </Button>
        ) : null}
        {scope.kind === 'org' ? (
          <ContactHostDialog
            site={scope.slug}
            hostName={scope.hostName}
            trigger={
              <Button type="button" variant="ghost" className="h-11 px-5" data-testid="search-write">
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('hostContact.trigger', { host: scope.hostName })}
              </Button>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
