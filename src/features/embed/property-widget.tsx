import { useEffect, type ReactNode } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useEmbed } from '@/features/embed/embed-context';
import { EmbedPropertyError, EmbedPropertyNotFound } from '@/features/embed/embed-states';
import { EmbedPropertyView } from '@/features/embed/property/embed-property-view';
import { useEmbedBridge } from '@/features/embed/use-embed-bridge';
import { PropertyPageSkeleton } from '@/features/public-booking/components/property-page-states';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import type { PublicOrgDto } from '@/types';

/** What the shell of the frame gives its widget (the same `{ org }` as `PublicSiteShell` gives the pages of the booking site). */
interface EmbedOutletContext {
  org: PublicOrgDto;
}

/**
 * One home inside the frame: `/embed/property/:propertySlugOrId` on the agency's domain, `/embed/<orgSlug>/property/:propertySlugOrId` on the CasaZen one
 * (NF-144). It is also the page the cards of the booking widget lead to, in the same frame. The data are the ones of the page of the home on the site (`useOrgPublicProperty`),
 * for the org of the frame only, and the states are the ones that page shows: a skeleton while it loads, «not available» for a 404 (the API answers 404 for a home that
 * does not exist and for one that is not bookable online), and an error with a retry for any other failure. The two that leave the frame with nothing to show also tell
 * the page that frames it (`error`), which then shows its own link to the site.
 *
 * A 404 is «not found» even when TanStack Query still holds an older answer for the home (it keeps the data it had on an error): what the server says last wins. Any
 * other failure of a later read leaves the page that is already there.
 */
export function PropertyWidget() {
  const { propertySlugOrId } = useParams<{ propertySlugOrId: string }>();
  const { org } = useOutletContext<EmbedOutletContext>();
  const embed = useEmbed();
  const { send } = useEmbedBridge();
  const orgSlug = embed?.orgSlug ?? org.slug;
  const { data: property, isLoading, isError, error, refetch } = useOrgPublicProperty(orgSlug, propertySlugOrId);

  const notFound = (isError && isAxiosError(error) && error.response?.status === 404) || (!isLoading && !isError && !property);
  const failed = !notFound && !property && isError;

  // The frame has nothing to show: the page is told, once for each time the widget gets there.
  useEffect(() => {
    if (notFound) send.error('not_found');
    else if (failed) send.error('load_failed');
  }, [notFound, failed, send]);

  let content: ReactNode;
  if (notFound) content = <EmbedPropertyNotFound />;
  else if (failed) content = <EmbedPropertyError onRetry={() => void refetch()} />;
  else if (!property) content = <PropertyPageSkeleton />;
  else content = <EmbedPropertyView property={property} org={org} orgSlug={orgSlug} />;

  return <div data-testid="embed-widget-property">{content}</div>;
}
