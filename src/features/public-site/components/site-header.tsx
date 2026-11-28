import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, ChevronRight, Menu } from 'lucide-react';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { FavoritesMenu } from '@/features/public-site/favorites/favorites-menu';
import { FROM_DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import type { PublicOrgDto } from '@/types';
import { LanguageSwitch } from './language-switch';
import { SiteNav } from './site-nav';
import { useSiteNavItems, type SiteNavItem } from './use-site-nav-items';

function scrollToBookingWidget() {
  const widget = document.getElementById('booking-widget');
  if (widget) {
    widget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const mobileCta = document.querySelector<HTMLButtonElement>('[data-testid="mobile-booking-trigger"]');
  if (mobileCta) {
    mobileCta.click();
    return;
  }
  document.getElementById('property-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

interface SiteHeaderProps {
  org?: PublicOrgDto;
  loading?: boolean;
  basePath: string;
  showBookingCta: boolean;
  themeId: string;
  fontId?: string | null;
  colorStyle?: CSSProperties;
}

export function SiteHeader({ org, loading = false, basePath, showBookingCta, themeId, fontId, colorStyle }: SiteHeaderProps) {
  const { t } = useTranslation();
  // One of the two exists at a time, so that the link to "Le mie prenotazioni" is in the page once.
  const fromDesktop = useMediaQuery(FROM_DESKTOP_QUERY);
  const navItems = useSiteNavItems(org?.slug, basePath);

  return (
    <header
      className="sticky top-0 z-30 border-b bg-[var(--cz-public-surface)]/95 backdrop-blur"
      data-testid="public-site-header"
    >
      <div className="mx-auto flex min-h-[var(--header-height)] max-w-[1200px] items-center gap-3 px-3 md:gap-4 md:px-4">
        <SiteBrand org={org} loading={loading} basePath={basePath} />
        {org ? <SiteNav items={navItems} label={t('siteHome.nav.label')} /> : null}
        {org ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {showBookingCta ? (
              <Button
                type="button"
                size="sm"
                className="public-site-cta hidden h-10 border-0 px-5 md:inline-flex"
                onClick={scrollToBookingWidget}
                data-testid="header-booking-cta"
              >
                {t('publicSite.mobileBookingCta')}
              </Button>
            ) : null}
            <LanguageSwitch className="hidden lg:inline-flex" />
            {org.slug ? <FavoritesMenu site={org.slug} /> : null}
            {fromDesktop ? (
              <Link
                to={`${basePath}/my-bookings`}
                className="public-site-outline inline-flex h-10 items-center gap-2 px-4 text-sm"
                data-testid="public-nav-my-bookings"
              >
                <CalendarCheck className="h-4 w-4" aria-hidden />
                {t('publicSite.navMyBookings')}
              </Link>
            ) : (
              <PhoneMenu
                displayName={org.displayName}
                basePath={basePath}
                navItems={navItems}
                themeId={themeId}
                fontId={fontId}
                colorStyle={colorStyle}
              />
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function SiteBrand({ org, loading, basePath }: { org?: PublicOrgDto; loading: boolean; basePath: string }) {
  const { t } = useTranslation();

  if (loading) {
    return <span aria-hidden className="h-7 w-40 animate-pulse rounded bg-black/10 motion-reduce:animate-none" />;
  }

  if (!org) {
    return (
      <a href="/" aria-label={t('site.nav.home')} className="rounded-lg py-1.5">
        <CasaZenLogo size={30} />
      </a>
    );
  }

  const name = org.displayName ?? '';
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '';

  return (
    <Link to={basePath} className="flex min-w-0 items-center gap-2.5 rounded-[var(--cz-public-radius)] py-1.5">
      {org.logoUrl ? (
        <img src={org.logoUrl} alt={name} className="h-9 w-auto max-w-[160px] object-contain md:h-10 md:max-w-[200px]" />
      ) : (
        <>
          {initial ? (
            <span
              aria-hidden
              className="public-display grid h-9 w-9 shrink-0 place-items-center rounded-[var(--cz-public-radius)] bg-[var(--cz-public-primary)] text-base text-[var(--cz-public-on-primary)]"
            >
              {initial}
            </span>
          ) : null}
          <span className="public-display truncate text-base font-semibold md:text-lg">{name}</span>
        </>
      )}
    </Link>
  );
}

function PhoneMenu({
  displayName,
  basePath,
  navItems,
  themeId,
  fontId,
  colorStyle,
}: {
  displayName: string;
  basePath: string;
  navItems: readonly SiteNavItem[];
  themeId: string;
  fontId?: string | null;
  colorStyle?: CSSProperties;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--cz-public-radius)] hover:bg-black/5"
        aria-label={t('publicSite.openMenu')}
      >
        <Menu className="h-6 w-6" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="public-site-root"
        data-theme={themeId}
        data-font={fontId ?? undefined}
        style={colorStyle}
        aria-describedby={undefined}
      >
        <SheetHeader className="px-5 pb-2 pr-14 pt-0">
          <SheetTitle className="public-display truncate text-xl">{displayName}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t('publicSite.menuLabel')} className="px-3 pb-4" onClick={() => setOpen(false)}>
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="flex min-h-12 items-center gap-3 rounded-[var(--cz-public-radius)] px-3 text-base font-medium hover:bg-black/5"
            >
              {item.label}
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--cz-public-muted)]" aria-hidden />
            </Link>
          ))}
          <Link
            to={`${basePath}/my-bookings`}
            className="flex min-h-12 items-center gap-3 rounded-[var(--cz-public-radius)] px-3 text-base font-medium hover:bg-black/5"
            data-testid="public-nav-my-bookings"
          >
            <CalendarCheck className="h-5 w-5 shrink-0 text-[var(--cz-public-primary-text)]" aria-hidden />
            {t('publicSite.navMyBookings')}
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--cz-public-muted)]" aria-hidden />
          </Link>
        </nav>
        <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-1">
          <span className="text-sm font-medium">{t('language.label')}</span>
          <LanguageSwitch />
        </div>
      </SheetContent>
    </Sheet>
  );
}
