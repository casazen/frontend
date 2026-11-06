import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { MarketplaceCatalogEntry } from '@/types';
import { httpsUrlOrNull } from '../lib/marketplace-entry';

/**
 * An external partner of the catalog, in the guided request of home services: what it does (its `benefit`, in the language of the
 * interface), the service categories it works for, and «Scopri», which opens ITS site in a new tab. Nothing of the host or of its
 * guests goes along (the address is the partner's home page, as the administrator entered it), and nothing says that CasaZen runs the
 * partner or has an agreement with it. A site that is not an `https` address is not offered.
 */
export function PartnerCard({ partner }: { partner: MarketplaceCatalogEntry }) {
  const { t } = useTranslation();
  const website = httpsUrlOrNull(partner.websiteUrl);
  const categories = partner.serviceCategories ?? [];

  return (
    <li className="flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4" data-testid={`marketplace-partner-${partner.code}`}>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words font-medium">{partner.name}</h3>
        {partner.benefit ? <p className="text-sm text-foreground/70">{partner.benefit}</p> : null}
      </div>
      {categories.length > 0 ? (
        <ul role="list" className="flex list-none flex-wrap gap-1.5">
          {categories.map((category) => (
            <li key={category}>
              <Badge variant="secondary">{getServiceCategoryLabel(category, t)}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {website ? (
        <Button asChild variant="outline" size="sm" className="mt-auto self-start">
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('marketplace.partners.learnMoreAria', { name: partner.name })}
            data-testid={`marketplace-partner-${partner.code}-link`}
          >
            {t('marketplace.partners.learnMore')}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </Button>
      ) : null}
    </li>
  );
}
