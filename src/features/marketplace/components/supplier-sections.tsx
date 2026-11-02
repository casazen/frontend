import { Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { displayableMediaUrls } from '@/lib/media-url';
import { formatWorkDuration } from '@/lib/work-duration';
import type { SupplierPicker, SupplierPickerService } from '@/types/service-request';
import { responseLabel, servicePriceLabel } from '../lib/supplier-labels';
import { VerifiedBadge } from './verified-badge';

/**
 * The parts of what a host reads about a supplier (MKT): the drawer of the quick look and the page of the supplier are made of the same
 * ones, so that what the drawer says is what the page says. Nothing about a commission (D3), nothing that is not measured (D24).
 */

/** Up to three photos of the supplier. */
export function SupplierPhotos({ supplier }: { supplier: SupplierPicker }) {
  const { t } = useTranslation();
  const urls = displayableMediaUrls(supplier.photoUrls).slice(0, 3);
  if (urls.length === 0) return null;

  return (
    <div className={urls.length === 1 ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-3 gap-2'}>
      {urls.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={t('marketplace.drawer.photoAlt', { name: supplier.legalName, index: index + 1 })}
          loading="lazy"
          className={urls.length === 1 ? 'aspect-video w-full rounded-md object-cover' : 'aspect-[4/3] w-full rounded-md object-cover'}
        />
      ))}
    </div>
  );
}

/** What can be trusted about the supplier: «Verificato» with what it means, and how fast it answers, only when that is measured. */
export function SupplierTrust({ supplier }: { supplier: SupplierPicker }) {
  const { t } = useTranslation();
  const response = responseLabel(supplier, t);
  if (!supplier.verified && !response) return null;

  return (
    <div className="space-y-3">
      {supplier.verified ? (
        <div className="space-y-1" data-testid="marketplace-verified-note">
          <VerifiedBadge />
          <p className="text-sm text-foreground/70">{t('marketplace.drawer.verifiedExplanation')}</p>
        </div>
      ) : null}
      {response ? (
        <p className="break-words text-sm font-medium" data-testid="marketplace-supplier-response">
          {response}
        </p>
      ) : null}
    </div>
  );
}

export function SupplierAbout({ supplier }: { supplier: SupplierPicker }) {
  const { t } = useTranslation();
  if (!supplier.bio) return null;

  return (
    <PlainSection title={t('marketplace.drawer.about')}>
      <p className="whitespace-pre-line break-words text-sm text-foreground/80">{supplier.bio}</p>
    </PlainSection>
  );
}

interface SupplierServicesProps {
  supplier: SupplierPicker;
  /** With it each service has its «Richiedi»: the request starts from that service. */
  onRequest?: (service: SupplierPickerService) => void;
}

/** The services of the supplier with «da {prezzo}» and how long they take («Su preventivo» when it gave no price). */
export function SupplierServices({ supplier, onRequest }: SupplierServicesProps) {
  const { t, i18n } = useTranslation();
  const services = supplier.services ?? [];
  if (services.length === 0) return null;

  return (
    <PlainSection title={t('marketplace.drawer.services')}>
      <ul className="divide-y" data-testid="marketplace-supplier-services">
        {services.map((service) => (
          <li key={service.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2" data-testid={`marketplace-service-${service.id}`}>
            <div className="min-w-0 space-y-0.5">
              <p className="break-words font-medium">{service.name}</p>
              <p className="break-words text-sm text-foreground/70">
                {[servicePriceLabel(service, t, i18n.language), service.durationMinutes ? formatWorkDuration(service.durationMinutes, t) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {onRequest ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                aria-label={t('marketplace.supplier.requestService', { service: service.name })}
                onClick={() => onRequest(service)}
                data-testid={`marketplace-request-service-${service.id}`}
              >
                {t('marketplace.supplier.request')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </PlainSection>
  );
}

/** What the supplier does and where. */
export function SupplierCoverage({ supplier }: { supplier: SupplierPicker }) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('marketplace.drawer.coverage')}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground/70">{t('marketplace.drawer.categories')}</dt>
        <dd className="flex flex-wrap gap-1">
          {supplier.categories.map((category) => (
            <Badge key={category} variant="outline" className="text-xs">
              {getServiceCategoryLabel(category, t)}
            </Badge>
          ))}
        </dd>
        {supplier.comuni.length > 0 ? (
          <>
            <dt className="text-foreground/70">{t('marketplace.drawer.areas')}</dt>
            <dd className="break-words">{supplier.comuni.join(', ')}</dd>
          </>
        ) : null}
      </dl>
    </PlainSection>
  );
}

export function SupplierContacts({ supplier }: { supplier: SupplierPicker }) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('marketplace.drawer.contacts')}>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Phone aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <a href={`tel:${supplier.phone}`} className="min-w-0 break-words hover:underline">
            {supplier.phone}
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <a href={`mailto:${supplier.email}`} className="min-w-0 break-all hover:underline">
            {supplier.email}
          </a>
        </div>
      </div>
    </PlainSection>
  );
}
