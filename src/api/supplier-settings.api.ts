import { ApiClient } from '@/api/client';
import type { SupplierSettings, SupplierSettingsInput } from '@/types/supplier-settings';

/** The settings of the supplier; the defaults while it never saved any (the server writes nothing on a read). */
export async function fetchSupplierSettings(): Promise<SupplierSettings> {
  return ApiClient.get<SupplierSettings>('/supplier/settings');
}

/** Replaces the five settings: the server takes all of them (422 `supplier_settings_invalid` names the one that is missing or out of range). */
export async function saveSupplierSettings(input: SupplierSettingsInput): Promise<SupplierSettings> {
  return ApiClient.put<SupplierSettings>('/supplier/settings', input);
}
