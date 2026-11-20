import { EmbedUnavailable } from '@/features/embed/embed-states';

/**
 * One home inside the frame: `/embed/property/:propertySlugOrId` on the agency's domain, `/embed/<orgSlug>/property/:propertySlugOrId` on the
 * CasaZen one (NF-144). A stub until its own task (E41/F01/US02/T02) replaces this file: it says what the pages say when a widget is off,
 * never a made-up home, and it asks the server for nothing.
 */
export function PropertyWidget() {
  return (
    <div data-testid="embed-widget-property">
      <EmbedUnavailable />
    </div>
  );
}
