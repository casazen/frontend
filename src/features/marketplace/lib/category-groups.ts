import type { SupplierPicker } from '@/types/service-request';

export function countByCategory(suppliers: readonly SupplierPicker[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const supplier of suppliers) {
    for (const category of new Set(supplier.categories)) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return counts;
}
