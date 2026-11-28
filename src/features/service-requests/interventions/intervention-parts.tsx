import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ImageOff, Phone } from 'lucide-react';
import { Timeline } from '@/components/shared/timeline/timeline';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FACT_LINK, Fact, Facts } from '@/features/bookings/components/booking-facts';
import { propertyPath } from '@/features/properties/properties-paths';
import { requestTitle } from '@/features/supplier/requests/request-model';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatStayDate } from '@/lib/stay-dates';
import { useWorkPhoto } from '@/queries/use-service-requests';
import type { ServiceRequest, ServiceRequestWorkPhoto } from '@/types/service-request';
import { historyEvents, PRICE_BASIS_KEYS, priceText, whenText } from '../long-rent/long-rent-request-model';
import { phoneHref } from './intervention-model';

const URGENCY_KEYS = {
  Normal: 'serviceRequest.urgencyNormal',
  High: 'serviceRequest.urgencyHigh',
  Emergency: 'serviceRequest.urgencyEmergency',
} as const;

const PAYMENT_MODE_KEYS: Readonly<Record<string, string>> = {
  Online: 'longRentRequests.detail.paymentMode.Online',
  Manual: 'longRentRequests.detail.paymentMode.Manual',
};

const PAYMENT_MODE_KNOWN = new Set(['PresoInCarico', 'InCorso', 'Completato', 'Pagato']);

const STAY_DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

export function InterventionFacts({ request, compact = false }: { request: ServiceRequest; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const when = whenText(request, language, t, true);
  const price = priceText(request, language);
  const basis = request.price?.basis;
  const basisKey = basis && Object.prototype.hasOwnProperty.call(PRICE_BASIS_KEYS, basis) ? PRICE_BASIS_KEYS[basis] : null;
  const paymentKey = PAYMENT_MODE_KNOWN.has(request.status) && request.paymentMode ? PAYMENT_MODE_KEYS[request.paymentMode] : undefined;
  const urgency = URGENCY_KEYS[request.urgency];
  const stay = request.stay;
  const place = [request.propertyName?.trim() || t('longRentRequests.detail.propertyFallback'), request.propertyCity?.trim()].filter(Boolean).join(' · ');

  return (
    <Facts>
      <Fact label={t('longRentRequests.detail.type')}>{getServiceCategoryLabel(request.category, t)}</Fact>
      {request.serviceName?.trim() ? <Fact label={t('longRentRequests.detail.service')}>{request.serviceName.trim()}</Fact> : null}
      <Fact label={t('longRentRequests.detail.property')}>
        <Link to={propertyPath(request.propertyId)} className={FACT_LINK}>
          {place}
        </Link>
      </Fact>
      {stay ? (
        <Fact label={t('interventions.detail.stay')}>
          <Link to={`/app/short-rent/bookings/${stay.bookingId}`} className={FACT_LINK} data-testid="intervention-stay-link">
            {[stay.guestName.trim(), t('interventions.detail.stayDates', { from: formatStayDate(stay.checkIn, language, STAY_DAY), to: formatStayDate(stay.checkOut, language, STAY_DAY) })]
              .filter(Boolean)
              .join(' · ')}
          </Link>
        </Fact>
      ) : null}
      <Fact label={t('longRentRequests.detail.when')}>{[when.day, when.time].filter(Boolean).join(' · ') || t('interventions.list.noTime')}</Fact>
      {compact ? null : <Fact label={t('longRentRequests.detail.urgency')}>{urgency ? t(urgency) : request.urgency}</Fact>}
      <Fact label={t('longRentRequests.detail.price')}>
        {price ? (
          <>
            {price}
            {basisKey ? <span className="text-foreground/70"> · {t(basisKey)}</span> : null}
          </>
        ) : (
          t('longRentRequests.detail.priceTbd')
        )}
      </Fact>
      {paymentKey && !compact ? <Fact label={t('longRentRequests.detail.payment')}>{t(paymentKey)}</Fact> : null}
      {request.notes?.trim() ? (
        <Fact label={t('longRentRequests.detail.notes')}>
          <span className="whitespace-pre-wrap">{request.notes.trim()}</span>
        </Fact>
      ) : null}
      {request.completionNotes?.trim() ? (
        <Fact label={t('longRentRequests.detail.supplierNotes')}>
          <span className="whitespace-pre-wrap">{request.completionNotes.trim()}</span>
        </Fact>
      ) : null}
    </Facts>
  );
}

export function InterventionSupplier({ request }: { request: ServiceRequest }) {
  const { t } = useTranslation();
  const contact = request.supplierContact;
  const phone = contact?.phone?.trim();
  const email = contact?.email?.trim();

  return (
    <Facts>
      <Fact label={t('longRentRequests.detail.supplier')}>{request.supplierName?.trim() || t('longRentRequests.detail.supplierFallback')}</Fact>
      {phone ? (
        <Fact label={t('interventions.detail.phone')}>
          <a href={phoneHref(phone)} className={FACT_LINK} data-testid="intervention-supplier-phone">
            <Phone aria-hidden="true" className="mr-1.5 size-4 shrink-0" />
            {phone}
          </a>
        </Fact>
      ) : null}
      {email ? (
        <Fact label={t('interventions.detail.email')}>
          <a href={`mailto:${email}`} className={FACT_LINK} data-testid="intervention-supplier-email">
            {email}
          </a>
        </Fact>
      ) : null}
    </Facts>
  );
}

export function InterventionHistory({ request, limit = Infinity }: { request: ServiceRequest; limit?: number }) {
  const { t } = useTranslation();
  return (
    <Timeline
      events={historyEvents(request, t)}
      order="asc"
      limit={limit}
      label={t('longRentRequests.detail.historyTitle')}
      emptyText={t('longRentRequests.detail.historyEmpty')}
      testId="intervention-history"
    />
  );
}

function WorkPhotoButton({ photo, index, count, onOpen }: { photo: ServiceRequestWorkPhoto; index: number; count: number; onOpen: (src: string) => void }) {
  const { t } = useTranslation();
  const { data: src, isError } = useWorkPhoto(photo.url);
  const label = t('interventions.photos.open', { index: index + 1, count });

  if (isError) {
    return (
      <div className="grid aspect-square place-items-center rounded-md bg-muted text-foreground/70" role="img" aria-label={t('interventions.photos.unavailable')}>
        <ImageOff aria-hidden="true" className="size-6" />
      </div>
    );
  }
  if (!src) return <Skeleton className="aspect-square w-full rounded-md motion-reduce:animate-none" />;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onOpen(src)}
      className="block aspect-square min-w-0 overflow-hidden rounded-md bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      data-testid="intervention-photo"
    >
      <img src={src} alt="" className="size-full object-cover" loading="lazy" />
    </button>
  );
}

export function InterventionPhotos({ request }: { request: ServiceRequest }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const photos = request.workPhotos ?? [];
  if (photos.length === 0) return null;

  return (
    <>
      <ul role="list" aria-label={t('interventions.photos.title')} className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="intervention-photos">
        {photos.map((photo, index) => (
          <li key={photo.id} className="min-w-0">
            <WorkPhotoButton photo={photo} index={index} count={photos.length} onOpen={setOpen} />
          </li>
        ))}
      </ul>
      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('interventions.photos.title')}</DialogTitle>
            <DialogDescription>{requestTitle(request, t)}</DialogDescription>
          </DialogHeader>
          {open ? <img src={open} alt={t('interventions.photos.alt', { title: requestTitle(request, t) })} className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md" /> : null}
          <Button type="button" variant="outline" onClick={() => setOpen(null)}>
            {t('interventions.photos.close')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
