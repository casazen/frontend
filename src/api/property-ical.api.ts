import { ApiClient } from './client';
import type {
  CalendarOverview,
  PropertyIcalExportUrl,
  PropertyIcalFeed,
  PropertyIcalFeedCreateRequest,
  PropertyIcalStatus,
} from '@/types/property-ical';

export const propertyIcalApi = {
  getCalendarOverview: () => ApiClient.get<CalendarOverview>('/properties/calendar-overview'),

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

  regenerateExportUrl: (propertyId: string) =>
    ApiClient.post<PropertyIcalExportUrl>(`/properties/${propertyId}/ical/export-url/regenerate`),
};
