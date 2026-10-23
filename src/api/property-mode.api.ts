import { ApiClient } from './client';
import type { RentalMode } from '@/types/property.types';
import type {
  PropertyModeChange,
  PropertyModePreview,
  PropertyModeState,
  SchedulePropertyModeChangeDto,
} from '@/types/property-mode.types';

/** The scheduled change of the rental mode of a property (PM-02, decision D16). */
export const propertyModeApi = {
  /** The mode of the property, the change waiting for its day and the last one that is over. */
  getState: (propertyId: string) => ApiClient.get<PropertyModeState>(`/properties/${propertyId}/mode`),

  /**
   * What a change to `to` meets: the first day possible and what stands in the way of `date` (the first day possible
   * when none is given). Reads only; it answers 200 even when the change is not possible, and says why in `issues`.
   * `date` is a stay date (`2026-12-01`).
   */
  preview: (propertyId: string, to: RentalMode, date?: string) =>
    ApiClient.get<PropertyModePreview>(`/properties/${propertyId}/mode/preview`, {
      to: to === 'Long' ? 'long' : 'short',
      date: date || undefined,
    }),

  /** Programs the change (201). The host gets an e-mail; to long-term the calendar closes from the night before the day. */
  schedule: (propertyId: string, data: SchedulePropertyModeChangeDto) =>
    ApiClient.post<PropertyModeChange>(`/properties/${propertyId}/mode/change`, data),

  /** Withdraws a change that is still waiting for its day (204). */
  cancel: (propertyId: string, changeId: string) =>
    ApiClient.delete<void>(`/properties/${propertyId}/mode/change/${changeId}`),
};
