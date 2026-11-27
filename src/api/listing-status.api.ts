import { ApiClient } from './client';
import type { ListingPropertySummary, ListingPublishRequest, ListingPublishResponse, ListingStatus, OutsideChangeChoice } from '@/types';

/**
 * The publication of a property to the channels and the state of each channel (E02/F03/US01/T02, T07; NF-09, NF-27, NF-38). All of it is
 * behind the backend flag `Features:OctorateConnector`: every endpoint answers 404 while it is off. Reading is `property.read`, writing
 * `property.write`, and a property of another org, or one the caller does not reach, answers 404.
 */
export const listingStatusApi = {
  /**
   * The channels of a property with their state, completeness, the steps of the wizard that lack data, the last confirmation, the lag,
   * the reason in simple words and the groups changed outside CasaZen. One entry for each channel the property was published to or is
   * managed on: empty while it was never published. Never writes to the channel manager.
   */
  getStatus: (propertyId: string) => ApiClient.get<ListingStatus>(`/properties/${propertyId}/channel-status`),

  /** The worst state of each property of the caller's scope that has a channel, for the list of the properties. */
  getSummary: () => ApiClient.get<ListingPropertySummary[]>('/properties/channel-status'),

  /**
   * Queues the publication (202, the channels now `Sending`). 409 `octorate_mapping_unconfirmed` (the listing must be confirmed or rejected
   * first), `octorate_existing_inventory_must_import`, `listing_modified_outside` (with the `channels` flagged: choose first, or send
   * `overwrite`); 422 `listing_content_incomplete` (with the `missing` texts), `listing_channels_required`, `listing_channel_unknown`.
   */
  publish: (propertyId: string, body: ListingPublishRequest) => ApiClient.post<ListingPublishResponse>(`/properties/${propertyId}/publish`, body),

  /**
   * The person's choice about a change made outside CasaZen on one channel (204): `keep` publishes CasaZen's version again, `take`
   * adopts the descriptions of the channel manager. 422 `outside_change_take_not_supported` when a group other than the descriptions
   * changed; 409 `outside_change_not_found`.
   */
  resolveOutsideChange: (propertyId: string, channelCode: string, choice: OutsideChangeChoice) =>
    ApiClient.post<void>(`/properties/${propertyId}/channels/${encodeURIComponent(channelCode)}/outside-change/resolve`, { choice }),
};
