import { describe, expect, it } from 'vitest';
import type { SupplierService } from '@/types/supplier-services';
import { planServices, sectionsOf, serviceOrderOf } from '../showcase-services';

const service = (slug: string, status: SupplierService['status'] = 'Active') => ({ id: `id-${slug}`, slug, name: slug, status }) as SupplierService;

const catalog = [service('pulizie'), service('bucato'), service('ripasso', 'Draft'), service('giardino'), service('vecchio', 'Paused')];
const slugs = (list: SupplierService[]) => list.map((item) => item.slug);

describe('planServices: the services the page shows (serviceOrder of SP-13a)', () => {
  it('shows every active service in the order of the catalog when there is no order, and sets drafts and paused ones apart', () => {
    for (const order of [undefined, []]) {
      const plan = planServices(catalog, order);
      expect(slugs(plan.shown)).toEqual(['pulizie', 'bucato', 'giardino']);
      expect(plan.hidden).toEqual([]);
      expect(slugs(plan.inactive)).toEqual(['ripasso', 'vecchio']);
    }
  });

  it('shows only the services the order names, in that order, and lists the other active ones as left out', () => {
    const plan = planServices(catalog, ['giardino', 'pulizie']);
    expect(slugs(plan.shown)).toEqual(['giardino', 'pulizie']);
    expect(slugs(plan.hidden)).toEqual(['bucato']);
  });

  it('drops a slug that is not an active service any more, and reads an order that names nothing alive as no order', () => {
    expect(slugs(planServices(catalog, ['ripasso', 'bucato', 'bucato', 'sparito']).shown)).toEqual(['bucato']);
    const plan = planServices(catalog, ['ripasso', 'sparito']);
    expect(slugs(plan.shown)).toEqual(['pulizie', 'bucato', 'giardino']);
    expect(plan.hidden).toEqual([]);
  });
});

describe('serviceOrderOf: what goes into the draft', () => {
  const [pulizie, bucato, , giardino] = catalog;

  it('sends nothing when every active service is shown in the order of the catalog, so a service added later shows up by itself', () => {
    expect(serviceOrderOf(catalog, [pulizie, bucato, giardino])).toBeNull();
  });

  it('sends the slugs in order when the order or the choice differs from the catalog', () => {
    expect(serviceOrderOf(catalog, [giardino, pulizie, bucato])).toEqual(['giardino', 'pulizie', 'bucato']);
    expect(serviceOrderOf(catalog, [bucato, giardino])).toEqual(['bucato', 'giardino']);
  });
});

describe('sectionsOf', () => {
  it('shows every section unless the draft says otherwise', () => {
    expect(sectionsOf(undefined)).toEqual({ trust: true, how: true, works: true, zones: true, certs: true, faq: true });
    expect(sectionsOf({ how: false })).toEqual({ trust: true, how: false, works: true, zones: true, certs: true, faq: true });
  });
});
