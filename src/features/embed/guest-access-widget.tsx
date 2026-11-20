import { EmbedUnavailable } from '@/features/embed/embed-states';

/**
 * The entry of the guest area inside the frame: `/embed/guest-access` on the agency's domain, `/embed/<orgSlug>/guest-access` on the CasaZen
 * one (NF-144). A stub until its own task (E41/F01/US02/T03) replaces this file: it says what the pages say when a widget is off, and it
 * asks the server for nothing.
 */
export function GuestAccessWidget() {
  return (
    <div data-testid="embed-widget-guest-access">
      <EmbedUnavailable />
    </div>
  );
}
