import axios from '@/lib/axios';
import type {
  ActivationStatus,
  SupplierAvailabilityResponse,
  SupplierInboxResponse,
  SupplierProfile,
  UpdateAvailabilityEntry,
} from '@/types/supplier';

export async function fetchSupplierActivation(): Promise<ActivationStatus> {
  const { data } = await axios.get<ActivationStatus>('/supplier/profile/activation');
  return data;
}

export async function completeSupplierActivation(tosAccepted: boolean): Promise<{ status: string }> {
  const { data } = await axios.post<{ status: string }>('/supplier/profile/activation/complete', {
    tosAccepted,
  });
  return data;
}

export async function fetchSupplierProfile(): Promise<SupplierProfile> {
  const { data } = await axios.get<SupplierProfile>('/supplier/profile');
  return data;
}

export async function updateSupplierProfile(
  payload: Partial<Pick<SupplierProfile, 'legalName' | 'vatNumber' | 'phone' | 'bio'>> & {
    categories?: string[];
    comuni?: string[];
    photoUrls?: string[];
  },
): Promise<SupplierProfile> {
  const { data } = await axios.put<SupplierProfile>('/supplier/profile', payload);
  return data;
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
