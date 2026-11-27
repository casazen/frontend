import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import type {
  SaveSupplierServiceBody,
  SupplierService,
  SupplierServiceList,
  UpdateSupplierServiceBody,
} from '@/types/supplier-services';

const BASE = '/supplier/services';
const urlOf = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

const UPLOAD_TIMEOUT_MS = 120_000;

export async function fetchSupplierServices(): Promise<SupplierServiceList> {
  return ApiClient.get<SupplierServiceList>(BASE);
}

export async function fetchSupplierService(id: string): Promise<SupplierService> {
  return ApiClient.get<SupplierService>(urlOf(id));
}

export async function createSupplierService(body: SaveSupplierServiceBody): Promise<SupplierService> {
  return ApiClient.post<SupplierService>(BASE, body);
}

export async function updateSupplierService(id: string, body: UpdateSupplierServiceBody): Promise<SupplierService> {
  return ApiClient.put<SupplierService>(urlOf(id), body);
}

export async function deleteSupplierService(id: string): Promise<void> {
  await ApiClient.delete(urlOf(id));
}

export async function publishSupplierService(id: string): Promise<SupplierService> {
  return ApiClient.post<SupplierService>(`${urlOf(id)}/publish`);
}

export async function pauseSupplierService(id: string): Promise<SupplierService> {
  return ApiClient.post<SupplierService>(`${urlOf(id)}/pause`);
}

export async function duplicateSupplierService(id: string): Promise<SupplierService> {
  return ApiClient.post<SupplierService>(`${urlOf(id)}/duplicate`);
}

export async function uploadSupplierServicePhotos(id: string, files: File[]): Promise<SupplierService> {
  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));
  const { data } = await axios.post<SupplierService>(`${urlOf(id)}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}
