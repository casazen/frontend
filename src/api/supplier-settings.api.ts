import { ApiClient } from '@/api/client';
import type { SupplierSettings, SupplierSettingsInput } from '@/types/supplier-settings';

export async function fetchSupplierSettings(): Promise<SupplierSettings> {
  return ApiClient.get<SupplierSettings>('/supplier/settings');
}

export async function saveSupplierSettings(input: SupplierSettingsInput): Promise<SupplierSettings> {
  return ApiClient.put<SupplierSettings>('/supplier/settings', input);
}
