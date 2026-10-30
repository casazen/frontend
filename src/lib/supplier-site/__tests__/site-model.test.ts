import { describe, expect, it } from 'vitest';
import type { PublicSupplierService } from '@/api/public-supplier.api';
import { applyServiceOrder } from '../site-model';

const service = (slug: string) => ({ slug, name: slug }) as PublicSupplierService;
const slugs = (list: PublicSupplierService[]) => list.map((item) => item.slug);

describe('applyServiceOrder: the services of a draft in the preview of the editor', () => {
  const services = [service('pulizie'), service('bucato'), service('giardino')];

  it('keeps every service as it comes when the draft names no order', () => {
    expect(applyServiceOrder(services, undefined)).toBe(services);
    expect(applyServiceOrder(services, [])).toBe(services);
  });

  it('shows only the services the draft names, in its order', () => {
    expect(slugs(applyServiceOrder(services, ['giardino', 'pulizie']))).toEqual(['giardino', 'pulizie']);
  });

  it('ignores a slug the page does not have and a repeated one, and keeps every service when none matches', () => {
    expect(slugs(applyServiceOrder(services, ['sparito', 'bucato', 'bucato']))).toEqual(['bucato']);
    expect(applyServiceOrder(services, ['sparito'])).toBe(services);
  });
});
