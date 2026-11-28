import { ApiClient } from './client';
import type { RentalMode } from '@/types/property.types';
import type {
  PropertyModeChange,
  PropertyModePreview,
  PropertyModeState,
  SchedulePropertyModeChangeDto,
} from '@/types/property-mode.types';

export const propertyModeApi = {
  getState: (propertyId: string) => ApiClient.get<PropertyModeState>(`/properties/${propertyId}/mode`),

  preview: (propertyId: string, to: RentalMode, date?: string) =>
    ApiClient.get<PropertyModePreview>(`/properties/${propertyId}/mode/preview`, {
      to: to === 'Long' ? 'long' : 'short',
      date: date || undefined,
    }),

  schedule: (propertyId: string, data: SchedulePropertyModeChangeDto) =>
    ApiClient.post<PropertyModeChange>(`/properties/${propertyId}/mode/change`, data),

  cancel: (propertyId: string, changeId: string) =>
    ApiClient.delete<void>(`/properties/${propertyId}/mode/change/${changeId}`),
};
