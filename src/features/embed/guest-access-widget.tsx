import { EmbedGuestAccessForm } from '@/features/embed/guest-access/embed-guest-access-form';

/**
 * The entry of the guest area inside the frame: `/embed/guest-access` on the agency's domain, `/embed/<orgSlug>/guest-access` on the CasaZen one (NF-144,
 * NF-143). One field for the booking code and one button that takes the whole page to the guest area of the booking site, which asks the e-mail or the last four
 * digits of the phone itself (see `EmbedGuestAccessForm`). The frame is as tall as the form and follows it. No request, no storage and no event: it needs
 * nothing of the org but its address, so it does not even read what the shell read.
 */
export function GuestAccessWidget() {
  return (
    <div data-testid="embed-widget-guest-access">
      <EmbedGuestAccessForm />
    </div>
  );
}
