import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { ExternalPartner } from '../lib/external-partners';

/**
 * An external partner (Integrazioni con partner esterni): what it does, the service categories it works for, and «Scopri», which
 * opens ITS site in a new tab. Nothing of the host or of its guests goes along (the address is the partner's home page, as is);
 * and nothing says that CasaZen runs the partner or has an agreement with it.
 */
export function PartnerCard({ partner }: { partner: ExternalPartner }) {
  const { t } = useTranslation();

  return (
    <li className="flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4" data-testid={`marketplace-partner-${partner.code}`}>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words font-medium">{partner.name}</h3>
        <p className="text-sm text-foreground/70">{t(`marketplace.partners.items.${partner.code}`)}</p>
      </div>
      <ul role="list" className="flex list-none flex-wrap gap-1.5">
        {partner.categories.map((category) => (
          <li key={category}>
            <Badge variant="secondary">{getServiceCategoryLabel(category, t)}</Badge>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" size="sm" className="mt-auto self-start">
        <a
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('marketplace.partners.learnMoreAria', { name: partner.name })}
          data-testid={`marketplace-partner-${partner.code}-link`}
        >
          {t('marketplace.partners.learnMore')}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </Button>
    </li>
  );
}
