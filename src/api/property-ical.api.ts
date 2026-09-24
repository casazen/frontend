import { ApiClient } from './client';
import type {
  PropertyIcalExportUrl,
  PropertyIcalFeed,
  PropertyIcalFeedCreateRequest,
  PropertyIcalStatus,
} from '@/types/property-ical';

export const propertyIcalApi = {
  getStatus: (propertyId: string) =>
    ApiClient.get<PropertyIcalStatus>(`/properties/${propertyId}/ical/status`),

  getFeeds: (propertyId: string) =>
    ApiClient.get<PropertyIcalFeed[]>(`/properties/${propertyId}/ical/feeds`),

  addFeed: (propertyId: string, data: PropertyIcalFeedCreateRequest) =>
    ApiClient.post<PropertyIcalFeed>(`/properties/${propertyId}/ical/feeds`, data),

  removeFeed: (propertyId: string, feedId: string) =>
    ApiClient.delete<void>(`/properties/${propertyId}/ical/feeds/${feedId}`),

  syncFeed: (propertyId: string, feedId: string) =>
    ApiClient.post<PropertyIcalFeed>(`/properties/${propertyId}/ical/feeds/${feedId}/sync`),

  getExportUrl: (propertyId: string) =>
    ApiClient.get<PropertyIcalExportUrl>(`/properties/${propertyId}/ical/export-url`),
};
