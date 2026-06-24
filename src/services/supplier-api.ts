import { ApiClient } from '@/api/client';
import type {
  ActivationStatus,
  CalendarSyncStatus,
  SupplierAvailabilityResponse,
  SupplierDashboard,
  SupplierInboxResponse,
  SupplierProfile,
  UpdateAvailabilityEntry,
} from '@/types/supplier';
import axios from '@/lib/axios';

export async function fetchSupplierActivation(): Promise<ActivationStatus> {
  return ApiClient.get<ActivationStatus>('/supplier/profile/activation');
}

export async function completeSupplierActivation(tosAccepted: boolean): Promise<{ status: string }> {
  return ApiClient.post<{ status: string }>('/supplier/profile/activation/complete', { tosAccepted });
}

export async function fetchSupplierProfile(): Promise<SupplierProfile> {
  return ApiClient.get<SupplierProfile>('/supplier/profile');
}

export async function updateSupplierProfile(
  payload: Partial<Pick<SupplierProfile, 'legalName' | 'vatNumber' | 'phone' | 'bio'>> & {
    categories?: string[];
    comuni?: string[];
    photoUrls?: string[];
  },
): Promise<SupplierProfile> {
  return ApiClient.put<SupplierProfile>('/supplier/profile', payload);
}

export async function fetchSupplierInbox(status = 'open', page = 1, pageSize = 20): Promise<SupplierInboxResponse> {
  const { data } = await axios.get<SupplierInboxResponse>('/supplier/inbox', {
    params: { status, page, pageSize },
  });
  return data;
}

export async function fetchSupplierAvailability(
  from: string,
  to: string,
): Promise<SupplierAvailabilityResponse> {
  const { data } = await axios.get<SupplierAvailabilityResponse>('/supplier/availability', {
    params: { from, to },
  });
  return data;
}

export async function updateSupplierAvailability(dates: UpdateAvailabilityEntry[]): Promise<{ updated: number }> {
  const { data } = await axios.put<{ updated: number }>('/supplier/availability', { dates });
  return data;
}

export async function inviteSupplier(payload: {
  email: string;
  comuneCode: string;
  categories?: string[];
  message?: string;
}): Promise<{ inviteId: string; expiresAt: string }> {
  const { data } = await axios.post<{ inviteId: string; expiresAt: string }>('/admin/suppliers/invite', payload);
  return data;
}

export async function registerSupplier(payload: {
  email: string;
  legalName: string;
  phone: string;
  comuneCode: string;
  inviteToken?: string;
}): Promise<{ orgId: string; authRedirectUrl: string }> {
  const { data } = await axios.post<{ orgId: string; authRedirectUrl: string }>('/suppliers/register', payload);
  return data;
}

export async function fetchSupplierDashboard(): Promise<SupplierDashboard> {
  return ApiClient.get<SupplierDashboard>('/supplier/dashboard');
}

export async function fetchCalendarSyncStatus(): Promise<CalendarSyncStatus> {
  return ApiClient.get<CalendarSyncStatus>('/supplier/calendar/status');
}

export async function setIcalFeed(icalFeedUrl: string): Promise<CalendarSyncStatus> {
  return ApiClient.put<CalendarSyncStatus>('/supplier/calendar/ical', { icalFeedUrl });
}

export async function uploadSupplierPhotos(files: File[]): Promise<{ urls: string[] }> {
  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));
  const { data } = await axios.post<{ urls: string[] }>('/supplier/profile/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
