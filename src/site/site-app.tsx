import type { i18n as I18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { SiteLayout } from './components/site-layout';
import { AboutPage, FeaturesPage, HomePage, PricingPage, SuppliersPage } from './components/site-pages-content';
import type { SiteLegal } from './site-config';
import type { SitePageId } from './site-pages';

export interface SiteAppProps {
  page: SitePageId;
  i18n: I18n;
  legal: SiteLegal;
  year: number;
}

function PageContent({ page, legal }: { page: SitePageId; legal: SiteLegal }) {
  switch (page) {
    case 'home':
      return <HomePage />;
    case 'features':
      return <FeaturesPage />;
    case 'pricing':
      return <PricingPage />;
    case 'suppliers':
      return <SuppliersPage />;
    case 'about':
      return <AboutPage legal={legal} />;
  }
}

/** One page of the public site, the same tree for the build-time render and the browser (SEO-VETRINA). */
export function SiteApp({ page, i18n, legal, year }: SiteAppProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <SiteLayout current={page} legal={legal} year={year}>
        <PageContent page={page} legal={legal} />
      </SiteLayout>
    </I18nextProvider>
  );
}
