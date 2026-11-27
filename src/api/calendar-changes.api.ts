import { ApiClient } from './client';
import type { CalendarChange, CalendarChangePreview, CalendarChangeRequest, CalendarChangeState } from '@/types/calendar-changes.types';

/** A read that did not come back as an object (an answer of another kind) is an error to show, not data to draw. */
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
  /** What a change would do, and nothing else (E08/F05/US02/T03): nothing is saved or sent. */
  preview: async (request: CalendarChangeRequest) => asPreview(await ApiClient.post<unknown>('/calendar/changes/preview', request)),

  /** Applies a change to every property, all or nothing: answers the process that sends it to the channel manager (201). */
  apply: async (request: CalendarChangeRequest) => asChange(await ApiClient.post<unknown>('/calendar/changes', request)),

  /** The changes of the caller's org it reaches, newest first, at most 50, optionally only those in a `state`. */
  list: async (state?: CalendarChangeState) => asChangeList(await ApiClient.get<unknown>('/calendar/changes', state ? { state } : undefined)),

  /** One change with the state of each property: a 404 is a change that is not there (or not the caller's). */
  get: async (id: string) => asChange(await ApiClient.get<unknown>(`/calendar/changes/${encodeURIComponent(id)}`)),

  /** Sends again a change that failed or was partly sent (202 with the change); 409 for a change in any other state. */
  retry: async (id: string) => asChange(await ApiClient.post<unknown>(`/calendar/changes/${encodeURIComponent(id)}/retry`)),
};
