import { useTranslation } from 'react-i18next';
import { CalendarClock, Loader2, MessageCircle, Phone, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactHostDialog } from '@/features/public-site/contact/contact-host-dialog';
import type { PublicOrgDto } from '@/types';

/** What the home shows under the cover while the homes are read: the shapes of the cards, so that the page does not jump. */
export function HomeSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="hm-skeleton" data-testid="home-loading">
      <span className="sr-only">{t('publicSite.loadingProperties')}</span>
      <div className="hm-grid hm-skel-grid" aria-hidden="true">
        {[0, 1, 2].map((key) => (
          <div key={key} className="hm-skel-card">
            <span className="hm-skel hm-skel-card__media" />
            <span className="hm-skel hm-skel-card__line" />
            <span className="hm-skel hm-skel-card__line hm-skel-card__line--short" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The homes could not be read: said as it is, with a way to try again, never as «no home published». */
export function HomeError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="hm-state" data-testid="home-error">
      <TriangleAlert aria-hidden="true" />
      <div className="hm-state__text">
        <h2>{t('publicSite.propertiesError.title')}</h2>
        <p>{t('publicSite.propertiesError.description')}</p>
      </div>
      <Button type="button" className="public-site-cta border-0" disabled={retrying} onClick={onRetry} data-testid="home-retry">
        {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {t('shared.errorFallback.tryAgain')}
      </Button>
    </div>
  );
}

/**
 * No home is published: a quiet page that says the next season is being prepared and gives the way to ask (write to the host, call
 * if they published a number). The page of a site that is not there at all is another one; this site exists and has nothing to book.
 */
export function HomeEmpty({ org, slug }: { org: PublicOrgDto; slug: string }) {
  const { t } = useTranslation();
  const hostName = org.hostName?.trim() || org.displayName;
  return (
    <div className="hm-state hm-state--center" data-testid="home-empty">
      <CalendarClock aria-hidden="true" />
      <div className="hm-state__text">
        <h2>{t('siteHome.empty.title')}</h2>
        <p>{t('siteHome.empty.text')}</p>
      </div>
      <div className="hm-state__actions">
        <ContactHostDialog
          site={slug}
          hostName={hostName}
          trigger={
            <Button type="button" className="public-site-cta h-11 border-0 px-5" data-testid="home-empty-write">
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('hostContact.trigger', { host: hostName })}
            </Button>
          }
        />
        {org.publicPhone ? (
          <a className="public-site-outline inline-flex h-11 items-center gap-2 px-5 text-sm" href={`tel:${org.publicPhone}`} data-testid="home-empty-call">
            <Phone className="h-4 w-4" aria-hidden="true" />
            {t('siteHome.empty.call')}
          </a>
        ) : null}
      </div>
    </div>
  );
}
