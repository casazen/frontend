import { useState } from 'react';
import { Link } from 'react-router-dom';
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

/** The entries of the menu: the blocks of the home that exist, as links to them. */
function navItems(model: SiteModel): { id: string; label: string }[] {
  const { blocks } = model;
  const items: { id: string; label: string }[] = [];
  if (blocks.services || blocks.categories) items.push({ id: 'servizi', label: 'services' });
  if (blocks.how) items.push({ id: 'come', label: 'how' });
  if (blocks.about) items.push({ id: 'chi-siamo', label: 'about' });
  if (blocks.works) items.push({ id: 'lavori', label: 'works' });
  if (blocks.zones) items.push({ id: 'zone', label: 'zones' });
  if (blocks.faq) items.push({ id: 'domande', label: 'faq' });
  return items.slice(0, 5);
}

interface SiteHeaderProps {
  model: SiteModel;
  /** `over`: floats transparent over the cover (the pages with a full-width scene); `solid` everywhere else. */
  variant: 'over' | 'solid';
  /** The links to the blocks of the home only work on the home. */
  onHome: boolean;
}

/**
 * The header of a supplier's site: its name or logo, the menu to the blocks of the page and, when the bookings are open, the one
 * action "Prenota ora". No phone and no "write to us" button: the contacts are not part of the site (interview Q4/Q7).
 */
export function SiteHeader({ model, variant, onHome }: SiteHeaderProps) {
  const { t } = useTranslation();
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useSiteDialogTheme();
  const items = onHome ? navItems(model) : [];
  const bookPath = buildBookingPath(model.slug);

  return (
    <header className={cn('vz-header', variant === 'over' ? 'vz-header--over' : 'vz-header--solid', variant === 'over' && scrolled && 'is-scrolled')}>
      <div className="vz-container vz-header__in">
        <Brand model={model} />
        {items.length > 0 ? (
          <nav className="vz-nav" aria-label={t('supplierSite.nav.label')}>
            {items.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {t(`supplierSite.nav.${item.label}`)}
              </a>
            ))}
          </nav>
        ) : null}
        <div className="vz-header__actions">
          {model.bookingsOpen ? (
            <Link to={bookPath} className="vz-btn vz-btn--primary vz-header__book">
              {t('supplierSite.cta.book')}
            </Link>
          ) : null}
          {items.length > 0 ? (
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <button type="button" className="vz-burger" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
                <Menu aria-hidden="true" />
                <span className="sr-only">{t('supplierSite.header.openMenu')}</span>
              </button>
              <DialogContent className="vz-dialog" aria-describedby={undefined} {...theme}>
                <DialogTitle className="vz-dialog__title">{model.name}</DialogTitle>
                <nav aria-label={t('supplierSite.nav.label')}>
                  <ul className="vz-menu">
                    {items.map((item) => (
                      <li key={item.id}>
                        <a href={`#${item.id}`} onClick={() => setMenuOpen(false)}>
                          {t(`supplierSite.nav.${item.label}`)}
                        </a>
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
