import type { MouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEmbed } from '@/features/embed/embed-context';
import { buildEmbedCheckoutUrl, embedCampaignOf } from '@/features/embed/embed-urls';
import { useEmbedBridge } from '@/features/embed/use-embed-bridge';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { quoteTotalCents } from '@/features/public-booking/booking/quote-helpers';
import { beginCheckoutEvent } from '@/lib/ga4-ecommerce';

/**
 * «Prenota» of the property widget, the ONLY way out to the checkout of every widget (NF-144): a payment is never made inside a frame (3-D Secure and the
 * payment element do not belong in a frame of 400 px, and the checkout, the sign-in and the portals are pages that no other site may frame). It is a real
 * link to the checkout on the origin of the frame (the agency's own domain, or CasaZen's) that takes the WHOLE page (`target="_top"`), with the stay, the language
 * and where the guest comes from (`buildEmbedCheckoutUrl`).
 *
 * When the loader of the page has answered (`bridge.attached`) a click is taken over: the frame tells the page `begin_checkout` (the total of the quote of the server and the
 * currency of the home, as the quote says them) and then asks it to go to the address (`navigate`, `top`), and the page, which knows its own history, does. Without a
 * loader (the page was opened on its own, a frame embedded by hand) nothing is taken over and the link navigates the top window by itself, so that the widget degrades
 * to a plain link. A click that asks for something else (a new tab, a modifier key) is left to the browser. It renders only when the quote of THIS stay is in
 * (`BookingCard` asks for it): never a link to a wrong total.
 */
export function EmbedCheckoutLink({ className }: { className: string }) {
  const { t } = useTranslation();
  const embed = useEmbed();
  const bridge = useEmbedBridge();
  const { property, stay, quote } = useBooking();
  const { search } = useLocation();
  if (!embed || quote.status !== 'ready') return null;

  const url = buildEmbedCheckoutUrl({
    origin: window.location.origin,
    hostMode: embed.hostMode,
    orgSlug: embed.orgSlug,
    property: { id: property.id, slug: property.slug },
    stay,
    lang: embed.lang,
    campaign: embedCampaignOf(search),
  });

  const book = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!bridge.attached) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    bridge.send.event('begin_checkout', {
      ...beginCheckoutEvent({
        propertyId: property.id,
        propertyName: property.name,
        place: property.city,
        currency: quote.quote.currency || property.currency,
        total: quoteTotalCents(quote.quote) / 100,
      }),
    });
    bridge.send.navigate(url, 'top');
  };

  return (
    <a href={url} target="_top" rel="noopener" className={className} onClick={book} data-testid="booking-cta">
      {t('propertyBooking.cta.book')}
    </a>
  );
}
