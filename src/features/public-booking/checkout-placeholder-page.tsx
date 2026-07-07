import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { PublicOrgDto } from '@/types';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/**
 * Checkout shell — payment flow owned by spec-direct-checkout (US-002).
 */
export function CheckoutPlaceholderPage() {
  const { t } = useTranslation();
  const { orgSlug, propertySlugOrId } = useParams<{ orgSlug: string; propertySlugOrId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const [searchParams] = useSearchParams();
  const checkIn = searchParams.get('checkIn') ?? '';
  const checkOut = searchParams.get('checkOut') ?? '';
  const { data: property, isLoading } = useOrgPublicProperty(orgSlug, propertySlugOrId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="checkout-placeholder">
      <Button asChild variant="ghost" className="px-0">
        <Link to={`/book/${orgSlug}/property/${propertySlugOrId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('publicBooking.backToProperty')}
        </Link>
      </Button>

      <h2 className="text-2xl font-bold">{t('publicBooking.checkoutTitle', { propertyName: property?.name ?? 'Struttura' })}</h2>

      {checkIn && checkOut && (
        <p className="text-muted-foreground">
          {t('publicBooking.checkoutPlaceholderDates', { checkIn, checkOut })}
        </p>
      )}

      <div className="rounded-lg border bg-muted/40 p-6 space-y-3">
        <p className="font-medium">{t('publicBooking.checkoutPlaceholderPaymentComing')}</p>
        <p className="text-sm text-muted-foreground">
          {t('publicBooking.checkoutPlaceholderDescription', { orgName: org.displayName })}
        </p>
      </div>
    </div>
  );
}
