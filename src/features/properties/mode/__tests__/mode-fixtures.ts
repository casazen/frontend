import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type {
  PropertyModeBlocker,
  PropertyModeChange,
  PropertyModePreview,
  PropertyModeState,
} from '@/types/property-mode.types';

export const PROPERTY_ID = 'c0c1d2e3-0000-4000-8000-0000000000aa';

export const TOMORROW = '2026-09-25';

export const state = (overrides: Partial<PropertyModeState> = {}): PropertyModeState => ({
  propertyId: PROPERTY_ID,
  rentalMode: 'Short',
  scheduledChange: null,
  lastChange: null,
  ...overrides,
});

export const change = (overrides: Partial<PropertyModeChange> = {}): PropertyModeChange => ({
  id: 'c1',
  propertyId: PROPERTY_ID,
  fromMode: 'Short',
  toMode: 'Long',
  effectiveDate: '2026-12-01',
  status: 'Scheduled',
  createdAt: '2026-09-24T10:00:00Z',
  appliedAt: null,
  cancelledAt: null,
  failedAt: null,
  failureReason: null,
  ...overrides,
});

export const blocker = (overrides: Partial<PropertyModeBlocker> = {}): PropertyModeBlocker => ({
  id: 'b1',
  kind: 'Stay',
  start: '2026-09-28',
  end: '2026-10-03',
  freeFrom: '2026-10-04',
  status: 'Confirmed',
  source: 'Direct',
  ...overrides,
});

export const preview = (overrides: Partial<PropertyModePreview> = {}): PropertyModePreview => ({
  propertyId: PROPERTY_ID,
  currentMode: 'Short',
  targetMode: 'Long',
  today: '2026-09-24',
  earliestDate: TOMORROW,
  date: TOMORROW,
  canSchedule: true,
  issues: [],
  blockers: [],
  calendarClosedUntil: null,
  scheduledChange: null,
  ...overrides,
});

export function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}
