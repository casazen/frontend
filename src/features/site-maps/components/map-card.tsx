import { ArrowRight, Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

export interface MapCardData {
  id: string;
  name: string;
  /** Zone or town. */
  zone?: string;
  photoUrl?: string;
  /** 0..5, only when the house has reviews. */
  rating?: number;
  /** The price as the page writes it («145 € a notte»). */
  priceLabel: string;
  /** Why the house is not free, when it is not («Non libera dal 12 ottobre»). */
  unavailableNote?: string;
  /** The page of the house. */
  href?: string;
}

interface MapCardProps {
  data: MapCardData | null;
  /** On a phone the card is a sheet from the bottom; elsewhere it sits over the map. */
  phone: boolean;
  onClose: () => void;
}

function CardBody({ data }: { data: MapCardData }) {
  const { t, i18n } = useTranslation();
  const body = (
    <>
      {data.photoUrl ? <img src={data.photoUrl} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
        <strong className="public-display truncate text-base">{data.name}</strong>
        {data.zone || data.rating != null ? (
          <span className="flex items-center gap-1.5 text-sm text-[var(--cz-public-muted,#555)]">
            {data.zone ? <span className="truncate">{data.zone}</span> : null}
            {data.rating != null ? (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span aria-hidden="true">{new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(data.rating)}</span>
                <span className="sr-only">{t('siteMap.rating', { value: data.rating.toFixed(1) })}</span>
              </span>
            ) : null}
          </span>
        ) : null}
        <b className="text-base">{data.priceLabel}</b>
        {data.unavailableNote ? <span className="text-sm text-[var(--cz-public-muted,#555)]">{data.unavailableNote}</span> : null}
      </span>
      {data.href ? (
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--cz-public-primary,#111)] text-[var(--cz-public-on-primary,#fff)]">
          <ArrowRight className="h-5 w-5" />
        </span>
      ) : null}
    </>
  );
  const cls = 'flex items-center gap-3 rounded-2xl p-2 text-left text-[var(--cz-public-text,#111)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cz-public-primary-text,#1d4ed8)]';
  return data.href ? (
    <Link to={data.href} className={cls} aria-label={`${data.name}, ${data.priceLabel}. ${t('siteMap.cardOpen')}`} data-testid="map-card-link">
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * The card of the house whose pin is selected. On a computer it floats over the map, bottom left, without taking the focus; on
 * a phone it is a sheet from the bottom (touching outside or Esc closes it) and the first touch on a pin opens it: a second
 * touch, on the card, goes to the page of the house.
 */
export function MapCard({ data, phone, onClose }: MapCardProps) {
  const { t } = useTranslation();
  if (phone) {
    return (
      <Sheet open={data !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="pb-4" data-testid="map-card">
          <SheetTitle className="sr-only">{data?.name ?? t('siteMap.cardTitle')}</SheetTitle>
          <SheetDescription className="sr-only">{data ? `${data.zone ?? ''} ${data.priceLabel}`.trim() : ''}</SheetDescription>
          <div className="px-3 pb-2">{data ? <CardBody data={data} /> : null}</div>
        </SheetContent>
      </Sheet>
    );
  }
  if (!data) return null;
  return (
    <div
      role="group"
      aria-label={data.name}
      data-testid="map-card"
      className="absolute bottom-4 left-4 z-40 flex w-[min(22rem,calc(100%-2rem))] items-start gap-1 rounded-2xl border border-[var(--cz-public-border,rgba(0,0,0,0.15))] bg-[var(--cz-public-surface,#fff)] p-1 shadow-xl"
    >
      <div className="min-w-0 flex-1">
        <CardBody data={data} />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('siteMap.cardClose')}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--cz-public-text,#111)] hover:bg-[var(--cz-public-bg,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cz-public-primary-text,#1d4ed8)]"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
