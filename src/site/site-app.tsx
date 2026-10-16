import type { i18n as I18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { SiteLayout } from './components/site-layout';
import { AboutPage, FeaturesPage, HomePage, SuppliersPage } from './components/site-pages-content';
import type { SiteLegal } from './site-config';
import type { SitePageId } from './site-pages';

export interface SiteAppProps {
  page: SitePageId;
  i18n: I18n;
  legal: SiteLegal;
  year: number;
  /** The "Accedi" link of the header. Absent: shown, the same as the pages of a preview (`src/config/login-entry.ts`). */
  showLogin?: boolean;
}

function PageContent({ page, legal }: { page: SitePageId; legal: SiteLegal }) {
  switch (page) {
    case 'home':
      return <HomePage legal={legal} />;
    case 'features':
      return <FeaturesPage legal={legal} />;
    case 'suppliers':
      return <SuppliersPage legal={legal} />;
    case 'about':
      return <AboutPage legal={legal} />;
  }
}

/** One page of the public site, the same tree for the build-time render and the browser (SEO-VETRINA). */
export function SiteApp({ page, i18n, legal, year, showLogin = true }: SiteAppProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <SiteLayout current={page} legal={legal} year={year} showLogin={showLogin}>
        <PageContent page={page} legal={legal} />
      </SiteLayout>
    </I18nextProvider>
  );
}
