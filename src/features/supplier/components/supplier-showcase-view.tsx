import { useTranslation } from 'react-i18next';
import { Calendar, MapPin, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SupplierShowcaseDto } from '@/api/public-supplier.api';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { displayableMediaUrls } from '@/lib/media-url';
import { formatStayDate } from '@/lib/stay-dates';

/**
 * The content of a supplier showcase: shown on the public page `/fornitori/:slug` and, identical, in the owner's preview
 * (SU-13). Presentation only: the page around it decides loading, error and "not published" states.
 */
export function SupplierShowcaseView({ showcase }: { showcase: SupplierShowcaseDto }) {
  const { t, i18n } = useTranslation();
  const photos = displayableMediaUrls(showcase.photoUrls);
  const availability = showcase.availability ?? [];
  const availableDays = availability.filter((d) => d.available).length;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-testid="supplier-showcase">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl" data-testid="supplier-showcase-name">
            {showcase.legalName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="supplier-showcase-photos">
              {photos.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt={t('supplierShowcase.photoAlt', { name: showcase.legalName })}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          {showcase.comuni.length > 0 && (
            <div>
              <h2 className="mb-1 text-sm font-medium">{t('supplierShowcase.comuniTitle')}</h2>
              <ul className="flex flex-wrap gap-2">
                {showcase.comuni.map((comune) => (
                  <li key={comune} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                    <MapPin className="h-3 w-3" aria-hidden="true" /> {comune}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showcase.categories.length > 0 && (
            <div>
              <h2 className="mb-1 text-sm font-medium">{t('supplierShowcase.servicesTitle')}</h2>
              <ul className="flex flex-wrap gap-2">
                {showcase.categories.map((code) => (
                  <li key={code} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                    <Wrench className="h-3 w-3" aria-hidden="true" /> {getServiceCategoryLabel(code, t)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showcase.bio && <p className="whitespace-pre-line text-sm text-muted-foreground">{showcase.bio}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('supplier.availabilityTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {availability.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="supplier-showcase-no-availability">
              {t('supplierShowcase.noAvailability')}
            </p>
          ) : (
            <>
              <p className="text-sm">{t('supplierShowcase.availableDays', { count: availableDays })}</p>
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                {availability.map((day) => (
                  <li
                    key={day.date}
                    className={`rounded p-2 text-center text-xs ${
                      day.available ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'
                    }`}
                  >
                    {formatStayDate(day.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
                    <span className="sr-only">
                      {' '}
                      {day.available ? t('supplier.available') : t('supplier.notAvailable')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
