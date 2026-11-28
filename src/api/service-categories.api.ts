import { ApiClient } from '@/api/client';

interface ServiceCategoriesResponse {
  items: { code: string }[];
}

export async function fetchServiceCategories(): Promise<string[]> {
  const data = await ApiClient.get<ServiceCategoriesResponse>('/service-categories');
  return data.items.map((item) => item.code);
}
