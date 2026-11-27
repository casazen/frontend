import { ApiClient } from './client';
import type { ListingPropertySummary, ListingPublishRequest, ListingPublishResponse, ListingStatus, OutsideChangeChoice } from '@/types';

export const listingStatusApi = {
  /**
   * The channels of a property with their state, completeness, the steps of the wizard that lack data, the last confirmation, the lag,
   * the reason in simple words and the groups changed outside CasaZen. One entry for each channel the property was published to or is
   * managed on: empty while it was never published. Never writes to the channel manager.
   */
  getStatus: (propertyId: string) => ApiClient.get<ListingStatus>(`/properties/${propertyId}/channel-status`),

  getSummary: () => ApiClient.get<ListingPropertySummary[]>('/properties/channel-status'),

  /**
   * Queues the publication (202, the channels now `Sending`). 409 `octorate_mapping_unconfirmed` (the listing must be confirmed or rejected
   * first), `octorate_existing_inventory_must_import`, `listing_modified_outside` (with the `channels` flagged: choose first, or send
   * `overwrite`); 422 `listing_content_incomplete` (with the `missing` texts), `listing_channels_required`, `listing_channel_unknown`.
   */
  publish: (propertyId: string, body: ListingPublishRequest) => ApiClient.post<ListingPublishResponse>(`/properties/${propertyId}/publish`, body),

  resolveOutsideChange: (propertyId: string, channelCode: string, choice: OutsideChangeChoice) =>
    ApiClient.post<void>(`/properties/${propertyId}/channels/${encodeURIComponent(channelCode)}/outside-change/resolve`, { choice }),
};
