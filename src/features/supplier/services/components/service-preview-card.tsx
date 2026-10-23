import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

export interface ServicePreviewCardProps {
  name: string;
  summary: string;
  /** The category as the customers read it ("Pulizie"). */
  categoryLabel?: string;
  /** "da 45 € a intervento" or "Su preventivo": what `formatPrice` says. */
  priceLabel: string;
  /** "2 h". */
  durationLabel: string;
  /** The supplier declared that the prices include VAT. Only then the card says so: nothing is promised otherwise. */
  includesVat: boolean;
  supplementCount: number;
  /** The cover photo, if the service has one. */
  photoUrl?: string | null;
  className?: string;
}

/**
 * How a customer meets a service in the list of the showcase: the cover, the name, a line, the price and the duration. It
 * is the same card the showcase draws (SP-09-FE) — until that exists in the code base this is the one place that draws
 * it, built from the same fields of the same API, so the preview cannot say anything the API does not carry. It reads the
 * form while the supplier types, so it never has to wait for a save.
 */
export function ServicePreviewCard({ name, summary, categoryLabel, priceLabel, durationLabel, includesVat, supplementCount, photoUrl, className }: ServicePreviewCardProps) {
  const { t } = useTranslation();
  const showPhoto = isDisplayableMediaUrl(photoUrl);

  return (
    <article
      aria-label={t('supplier.services.preview.label')}
      className={cn('min-w-0 overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm ring-1 ring-inset ring-border', className)}
      data-testid="service-preview-card"
    >
      <div className="aspect-[4/3] bg-muted">
        {showPhoto ? (
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center text-foreground/70">
            <ImageOff aria-hidden="true" className="size-8" />
            <p className="text-xs">{t('supplier.services.preview.noPhoto')}</p>
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        {categoryLabel ? <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">{categoryLabel}</p> : null}
        <h3 className={cn('break-words text-base font-semibold leading-snug', name.trim() === '' && 'font-normal text-foreground/70')} data-testid="service-preview-name">
          {name.trim() === '' ? t('supplier.services.preview.namePlaceholder') : name}
        </h3>
        <p className={cn('break-words text-sm', summary.trim() === '' ? 'text-foreground/70' : 'text-foreground/80')} data-testid="service-preview-summary">
          {summary.trim() === '' ? t('supplier.services.preview.summaryPlaceholder') : summary}
        </p>
        <p className="break-words text-sm" data-testid="service-preview-price">
          <strong className="font-semibold">{priceLabel}</strong> · <span>{durationLabel}</span>
        </p>
        {includesVat || supplementCount > 0 ? (
          <p className="break-words text-xs text-foreground/70" data-testid="service-preview-notes">
            {[
              includesVat ? t('supplier.services.preview.includesVat') : null,
              supplementCount > 0 ? t('supplier.services.preview.supplements', { count: supplementCount }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
      </div>
    </article>
  );
}
