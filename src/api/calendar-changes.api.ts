import { ApiClient } from './client';
import type { CalendarChange, CalendarChangePreview, CalendarChangeRequest, CalendarChangeState } from '@/types/calendar-changes.types';

function asChange(value: unknown): CalendarChange {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Unexpected answer of the calendar change');
  const change = value as CalendarChange;
  return { ...change, properties: Array.isArray(change.properties) ? change.properties : [] };
}

function asChangeList(value: unknown): CalendarChange[] {
  if (!Array.isArray(value)) throw new Error('Unexpected answer of the list of calendar changes');
  return value.map(asChange);
}

function asPreview(value: unknown): CalendarChangePreview {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Unexpected answer of the preview of the calendar change');
  const preview = value as CalendarChangePreview;
  return {
    ...preview,
    properties: Array.isArray(preview.properties)
      ? preview.properties.map((property) => ({ ...property, samples: Array.isArray(property.samples) ? property.samples : [] }))
      : [],
    warnings: Array.isArray(preview.warnings) ? preview.warnings : [],
  };
}

export const calendarChangesApi = {
  preview: async (request: CalendarChangeRequest) => asPreview(await ApiClient.post<unknown>('/calendar/changes/preview', request)),

  apply: async (request: CalendarChangeRequest) => asChange(await ApiClient.post<unknown>('/calendar/changes', request)),

  list: async (state?: CalendarChangeState) => asChangeList(await ApiClient.get<unknown>('/calendar/changes', state ? { state } : undefined)),

  get: async (id: string) => asChange(await ApiClient.get<unknown>(`/calendar/changes/${encodeURIComponent(id)}`)),

  retry: async (id: string) => asChange(await ApiClient.post<unknown>(`/calendar/changes/${encodeURIComponent(id)}/retry`)),
};
