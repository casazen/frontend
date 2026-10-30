import { useTranslation } from 'react-i18next';
import { MarketplaceFrame } from './components/marketplace-frame';
import { RequestsSection } from './components/requests-section';
import { MARKETPLACE_PATH } from './lib/marketplace-paths';

/**
 * Le mie app (MKT): what the host already uses of the marketplace. For now the requests of the property, as they were at the foot of
 * the old page, with what happened to each; the suppliers the host asked before come above them (SR-09c).
 */
export function MarketplaceMinePage() {
  const { t } = useTranslation();

  return (
    <MarketplaceFrame
      section="mine"
      title={t('marketplace.mine.title')}
      description={t('marketplace.mine.description')}
      trail={[{ label: t('marketplace.title'), path: MARKETPLACE_PATH }, { label: t('marketplace.mine.title') }]}
      needsComune={false}
    >
      {({ property }) => <RequestsSection propertyId={property.id} />}
    </MarketplaceFrame>
  );
}
