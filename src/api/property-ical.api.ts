import { ApiClient } from './client';
import type {
  PropertyIcalExportUrl,
  PropertyIcalImportUrlRequest,
  PropertyIcalStatus,
} from '@/types/property-ical';

export const propertyIcalApi = {
  getStatus: (propertyId: string) =>
    ApiClient.get<PropertyIcalStatus>(`/properties/${propertyId}/ical/status`),

  setImportUrl: (propertyId: string, data: PropertyIcalImportUrlRequest) =>
    ApiClient.post<PropertyIcalStatus>(`/properties/${propertyId}/ical/import-url`, data),

  getExportUrl: (propertyId: string) =>
    ApiClient.get<PropertyIcalExportUrl>(`/properties/${propertyId}/ical/export-url`),
};
