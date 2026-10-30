import { useTranslation } from 'react-i18next';
import { BadgeCheck, ClipboardCheck, Clock, Lock } from 'lucide-react';
import { formatTypicalResponse } from '@/lib/supplier-site/format';
import type { SiteModel, SiteTrustItem } from '@/lib/supplier-site/site-model';

function TrustIcon({ kind }: { kind: SiteTrustItem['kind'] }) {
  if (kind === 'verified') return <BadgeCheck aria-hidden="true" />;
  if (kind === 'jobs') return <ClipboardCheck aria-hidden="true" />;
  if (kind === 'response') return <Clock aria-hidden="true" />;
  return <Lock aria-hidden="true" />;
}

/**
 * The bar of trust, right under the cover: only what is measured or checked by the platform. "Verificato" (active profile, a VAT
 * number and an account that takes payments), the jobs done with CasaZen from a few of them, the typical time to answer (the
 * measured median, never written by hand) and the secure payment, when it is on. No rating, no reviews, no "insured", no years.
 */
export function TrustBar({ model }: { model: SiteModel }) {
  const { t, i18n } = useTranslation();
  if (!model.blocks.trust) return null;

  const text = (item: SiteTrustItem): { value: string; label: string } => {
    switch (item.kind) {
      case 'verified':
        return { value: t('supplierSite.trust.verified'), label: t('supplierSite.trust.verifiedBy') };
      case 'jobs':
        return { value: new Intl.NumberFormat(i18n.language).format(item.count ?? 0), label: t('supplierSite.trust.jobs') };
      case 'response':
        return { value: formatTypicalResponse(item.minutes ?? 0, t), label: t('supplierSite.trust.response') };
      case 'payments':
        return { value: t('supplierSite.trust.payments'), label: t('supplierSite.trust.paymentsBy') };
    }
  };

  return (
    <section className="vh-trust" aria-label={t('supplierSite.trust.label', { name: model.name })} data-testid="supplier-site-trust">
      <div className="vz-container">
        <ul className="vz-trust">
          {model.trust.map((item) => {
            const { value, label } = text(item);
            return (
              <li key={item.kind} data-testid={`supplier-site-trust-${item.kind}`}>
                <span className="vz-trust__i">
                  <TrustIcon kind={item.kind} />
                </span>
                <span className="vz-trust__t">
                  <strong>{value}</strong>
                  <span>{label}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
