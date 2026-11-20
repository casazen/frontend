import { EmbedUnavailable } from '@/features/embed/embed-states';

/**
 * The booking engine inside the frame: `/embed/booking` on the agency's domain, `/embed/<orgSlug>/booking` on the CasaZen one (NF-144).
 * A stub until its own task (E41/F01/US02/T01) replaces this file: it says what the pages say when a widget is off, never a made-up
 * result, and it asks the server for nothing.
 */
export function BookingWidget() {
  return (
    <div data-testid="embed-widget-booking">
      <EmbedUnavailable />
    </div>
  );
}
