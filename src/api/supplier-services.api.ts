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

/** The services that are not deleted, by position, and how many the supplier can have (`GET api/supplier/services`). */
export async function fetchSupplierServices(): Promise<SupplierServiceList> {
  return ApiClient.get<SupplierServiceList>(BASE);
}

/** One service of the caller's catalog; 404 `supplier_service_not_found` for another supplier's or a deleted one. */
export async function fetchSupplierService(id: string): Promise<SupplierService> {
  return ApiClient.get<SupplierService>(urlOf(id));
}

/** Creates a draft (it may be incomplete): 201 with the service. 422 `supplier_service_limit_reached` at the 30th. */
export async function createSupplierService(body: SaveSupplierServiceBody): Promise<SupplierService> {
  return ApiClient.post<SupplierService>(BASE, body);
}

/** Replaces the content of a service; 409 `supplier_service_changed` when `version` is stale. */
export async function updateSupplierService(id: string, body: UpdateSupplierServiceBody): Promise<SupplierService> {
  return ApiClient.put<SupplierService>(urlOf(id), body);
}

/** Deletes a service (soft: it leaves every list). */
export async function deleteSupplierService(id: string): Promise<void> {
  await ApiClient.delete(urlOf(id));
}

/** Publishes a draft or paused service; 422 `supplier_service_not_publishable` (with `fields`) while it lacks something. */
export async function publishSupplierService(id: string): Promise<SupplierService> {
  return ApiClient.post<SupplierService>(`${urlOf(id)}/publish`);
}

/** Pauses a published service; 422 `supplier_service_cannot_pause` for a draft. */
export async function pauseSupplierService(id: string): Promise<SupplierService> {
  return ApiClient.post<SupplierService>(`${urlOf(id)}/pause`);
}

/** A draft copy of a service (same content and photos, "(copia)" after the name): 201. */
export async function duplicateSupplierService(id: string): Promise<SupplierService> {
  return ApiClient.post<SupplierService>(`${urlOf(id)}/duplicate`);
}

/**
 * Adds photos (multipart `photos`: up to 6 files of 10 MB, JPEG/PNG/WebP, 6 per service; all or none). The answer is the
 * service with its new `version`.
 */
export async function uploadSupplierServicePhotos(id: string, files: File[]): Promise<SupplierService> {
  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));
  const { data } = await axios.post<SupplierService>(`${urlOf(id)}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
