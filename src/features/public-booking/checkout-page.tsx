import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard, Loader2, SearchX } from 'lucide-react';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import { Button } from '@/components/ui/button';
import { PublicSiteState } from '@/features/public-site/components/public-site-state';
import { BookingProvider } from '@/features/public-booking/booking/booking-provider';
import { CheckoutFlow } from '@/features/public-booking/checkout/checkout-flow';
import { EMPTY_DRAFT, type CheckoutDraft } from '@/features/public-booking/checkout/checkout-model';
import { buildOrgBookingPath } from '@/lib/booking-url';
import type { PublicOrgDto } from '@/types';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/**
 * `/book/:orgSlug/property/:slug/checkout` (DB-05): loads the home and then hands over to the checkout in three steps. A home that does
 * not exist is said so; a site whose host cannot take payments yet gets a gentle page with the way to write, not a form that would fail
 * after the guest filled it.
 */
export function CheckoutPage() {
  const { t } = useTranslation();
  const { orgSlug = '', propertySlugOrId } = useParams<{ orgSlug: string; propertySlugOrId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { data: property, isLoading, isError } = useOrgPublicProperty(orgSlug, propertySlugOrId);
  // Everything the guest chose and typed, kept while they move between the steps. Never in the address, never in a log.
  const [draft, setDraft] = useState<CheckoutDraft>(EMPTY_DRAFT);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cz-public-primary-text)]" aria-hidden />
        <span className="sr-only">{t('publicSite.loading')}</span>
      </div>
    );
  }

  if (isError || !property) {
    return (
      <PublicSiteState
        icon={SearchX}
        testId="checkout-property-not-found"
        title={t('publicProperty.notFound.title')}
        description={t('publicProperty.notFound.text')}
      >
        <Button asChild variant="outline">
          <Link to={buildOrgBookingPath(orgSlug)}>{t('publicBooking.backToProperties')}</Link>
        </Button>
      </PublicSiteState>
    );
  }

  const hostLabel = property.hostName?.trim() || org.displayName?.trim() || '';

  if (property.acceptsBookings === false) {
    return (
      <PublicSiteState
        icon={CreditCard}
        testId="checkout-payments-off"
        title={t('publicCheckout.paymentsOff.title')}
        description={t('publicCheckout.paymentsOff.text', { host: hostLabel })}
      >
        {org.contactEmail ? (
          <Button asChild>
            <a href={`mailto:${org.contactEmail}`}>{t('publicCheckout.paymentsOff.write', { host: hostLabel })}</a>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to={buildOrgBookingPath(orgSlug)}>{t('publicBooking.backToOrg', { orgName: org.displayName })}</Link>
        </Button>
      </PublicSiteState>
    );
  }

  return (
    <BookingProvider
      property={property}
      orgSlug={orgSlug}
      hostLabel={hostLabel}
      contactEmail={org.contactEmail}
      childrenAges={draft.childrenAges}
    >
      <CheckoutFlow org={org} orgSlug={orgSlug} draft={draft} onDraft={setDraft} />
    </BookingProvider>
  );
}
