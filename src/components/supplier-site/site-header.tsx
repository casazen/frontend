import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { buildBookingPath } from '@/lib/supplier-site/booking-params';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { cn } from '@/lib/utils';
import { useSiteDialogTheme } from './site-context';
import { useScrolled } from './use-scrolled';

/** The first letters of the name, for the mark of a supplier that has no logo: "Splendore Pulizie" is "SP". */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '');
  return letters.join('').toUpperCase();
}

function Brand({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const { logo, name } = model;
  return (
    <Link to={supplierSitePaths.home(model.slug)} className="vz-brand" aria-label={t('supplierSite.header.home', { name })}>
      {logo.mode === 'image' && logo.url ? (
        <img className="vz-brand__img" src={logo.url} alt="" height={40} />
      ) : logo.mode === 'text' ? (
        <span className="vz-brand__name vz-brand__name--big" data-testid="supplier-showcase-name">
          {name}
        </span>
      ) : (
        <>
          <span className="vz-brand__mark" aria-hidden="true">
            {initials(name)}
          </span>
          <span className="vz-brand__name" data-testid="supplier-showcase-name">
            {name}
          </span>
        </>
      )}
    </Link>
  );
}

/** An entry of the menu: a page of the site, or (on the home only) a block of the home. */
interface NavEntry {
  key: string;
  label: string;
  /** A page of the site. */
  to?: string;
  /** The id of a block of the home. */
  hash?: string;
}

/**
 * The entries of the menu: the pages that exist (the services, the story) and, on the home, the blocks that exist. Nothing is offered
 * that has nothing behind it.
 */
function navEntries(model: SiteModel, onHome: boolean): NavEntry[] {
  const { blocks, slug } = model;
  const entries: NavEntry[] = [];
  if (blocks.services) entries.push({ key: 'services', label: 'services', to: supplierSitePaths.services(slug) });
  else if (onHome && blocks.categories) entries.push({ key: 'services', label: 'services', hash: 'servizi' });
  if (onHome) {
    if (blocks.how) entries.push({ key: 'how', label: 'how', hash: 'come' });
    if (blocks.works) entries.push({ key: 'works', label: 'works', hash: 'lavori' });
    if (blocks.zones) entries.push({ key: 'zones', label: 'zones', hash: 'zone' });
    if (blocks.faq) entries.push({ key: 'faq', label: 'faq', hash: 'domande' });
  }
  if (blocks.aboutPage) entries.push({ key: 'about', label: 'about', to: supplierSitePaths.about(slug) });
  return entries.slice(0, 5);
}

interface SiteHeaderProps {
  model: SiteModel;
  /** `over`: floats transparent over the cover (the pages with a full-width scene); `solid` everywhere else. */
  variant: 'over' | 'solid';
  /** The links to the blocks of the home only work on the home. */
  onHome: boolean;
}

/**
 * The header of a supplier's site: its name or logo, the menu to the pages and the blocks that exist and, when the bookings are open,
 * the one action "Prenota ora". No phone and no "write to us" button: the contacts are not part of the site (interview Q4/Q7).
 */
export function SiteHeader({ model, variant, onHome }: SiteHeaderProps) {
  const { t } = useTranslation();
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useSiteDialogTheme();
  const entries = navEntries(model, onHome);
  const bookPath = buildBookingPath(model.slug);
  const label = (entry: NavEntry) => t(`supplierSite.nav.${entry.label}`);

  return (
    <header className={cn('vz-header', variant === 'over' ? 'vz-header--over' : 'vz-header--solid', variant === 'over' && scrolled && 'is-scrolled')}>
      <div className="vz-container vz-header__in">
        <Brand model={model} />
        {entries.length > 0 ? (
          <nav className="vz-nav" aria-label={t('supplierSite.nav.label')}>
            {entries.map((entry) =>
              entry.to ? (
                <NavLink key={entry.key} to={entry.to}>
                  {label(entry)}
                </NavLink>
              ) : (
                <a key={entry.key} href={`#${entry.hash}`}>
                  {label(entry)}
                </a>
              ),
            )}
          </nav>
        ) : null}
        <div className="vz-header__actions">
          {model.bookingsOpen ? (
            <Link to={bookPath} className="vz-btn vz-btn--primary vz-header__book">
              {t('supplierSite.cta.book')}
            </Link>
          ) : null}
          {entries.length > 0 ? (
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <button type="button" className="vz-burger" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
                <Menu aria-hidden="true" />
                <span className="sr-only">{t('supplierSite.header.openMenu')}</span>
              </button>
              <DialogContent className="vz-dialog" aria-describedby={undefined} {...theme}>
                <DialogTitle className="vz-dialog__title">{model.name}</DialogTitle>
                <nav aria-label={t('supplierSite.nav.label')}>
                  <ul className="vz-menu">
                    {entries.map((entry) => (
                      <li key={entry.key}>
                        {entry.to ? (
                          <Link to={entry.to} onClick={() => setMenuOpen(false)}>
                            {label(entry)}
                          </Link>
                        ) : (
                          <a href={`#${entry.hash}`} onClick={() => setMenuOpen(false)}>
                            {label(entry)}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
                {model.bookingsOpen ? (
                  <Link to={bookPath} className="vz-btn vz-btn--primary vz-btn--lg" onClick={() => setMenuOpen(false)}>
                    {t('supplierSite.cta.book')}
                  </Link>
                ) : null}
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>
    </header>
  );
}
