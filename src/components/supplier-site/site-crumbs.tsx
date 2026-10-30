import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';

interface Crumb {
  label: string;
  /** Without it the crumb is the page the person is on. */
  to?: string;
}

/** "Home › Servizi › Name": where the person is on the site; the last crumb is the page itself and not a link. */
export function SiteCrumbs({ slug, items }: { slug: string; items: Crumb[] }) {
  const { t } = useTranslation();
  const all: Crumb[] = [{ label: t('supplierSite.crumbs.home'), to: supplierSitePaths.home(slug) }, ...items];
  return (
    <nav className="vz-crumbs" aria-label={t('supplierSite.crumbs.label')}>
      <ol>
        {all.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`}>
            {crumb.to && index < all.length - 1 ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
