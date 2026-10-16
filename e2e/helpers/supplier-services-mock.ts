import type { Page, Route } from '@playwright/test';

/** A service of the catalog as `GET api/supplier/services` answers it (SP-02): the fields the screens of SP-06 read. */
export interface MockService {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string | null;
  description: string | null;
  priceFromCents: number | null;
  priceUnit: 'PerJob' | 'PerHour' | 'PerSet' | 'PerSquareMeter';
  pricesIncludeVat: boolean;
  requiresQuote: boolean;
  durationMinutes: number | null;
  minNoticeHours: number | null;
  weekdays: string[];
  supplements: { code: string; label: string; amountCents: number; per: string; max?: number | null }[];
  included: string[];
  excluded: string[];
  photoUrls: string[];
  status: 'Draft' | 'Active' | 'Paused';
  sortOrder: number;
  publishable: boolean;
  missingForPublication: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierServicesMock {
  /** The services as the API holds them now. */
  services: () => MockService[];
  /** Every call that reached the catalog, in order: what a spec asserts to know what the screen sent. */
  calls: { method: string; path: string; body?: unknown }[];
  /** Changes a service behind the back of the page (another tab, another user): its version moves on. */
  touch: (id: string, changes?: Partial<MockService>) => void;
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** A photo that needs no network: a small drawing as a `data:` address (the screens show absolute `https`, `http`, `blob` and `data` addresses). */
export function drawing(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#8fb3a6"/><text x="6" y="34" font-size="12" fill="#10231c">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function mockService(overrides: Partial<MockService> = {}): MockService {
  return {
    id: 'svc-1',
    slug: 'pulizia-cambio-ospiti',
    name: 'Pulizia cambio ospiti',
    category: 'cleaning',
    summary: 'La casa pronta per il prossimo ospite.',
    description: null,
    priceFromCents: 4500,
    priceUnit: 'PerJob',
    pricesIncludeVat: false,
    requiresQuote: false,
    durationMinutes: 120,
    minNoticeHours: null,
    weekdays: WEEK,
    supplements: [],
    included: [],
    excluded: [],
    photoUrls: [],
    status: 'Active',
    sortOrder: 0,
    publishable: true,
    missingForPublication: [],
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-12T08:30:00Z',
    version: 1,
    ...overrides,
  };
}

function missingFor(service: MockService): string[] {
  const missing: string[] = [];
  if (service.name.trim() === '') missing.push('name');
  if (!service.category) missing.push('category');
  if (!service.durationMinutes || service.durationMinutes <= 0) missing.push('durationMinutes');
  if (!service.requiresQuote && !(service.priceFromCents && service.priceFromCents > 0)) missing.push('priceFromCents');
  return missing;
}

/** The names of the files of a multipart body (`filename="cucina.png"`): the mock needs no more of it. */
function uploadedNames(buffer: Buffer | null): string[] {
  if (!buffer) return [];
  return [...buffer.toString('latin1').matchAll(/filename="([^"]+)"/g)].map((match) => match[1]!);
}

/**
 * The catalog of services of the supplier, stateful like the API (SP-02): the list with its limit, create (a draft), read,
 * replace with the `version` (409 if stale), publish (422 with `fields` while something is missing), pause, duplicate, delete,
 * photos (`multipart`, the first is the cover; `photoUrls` of a replace can only keep or reorder the service's own). Register it
 * after `mockSupplierConsoleApi`: the later route is the one that answers.
 */
export async function mockSupplierServicesApi(page: Page, options: { services?: MockService[]; limit?: number } = {}): Promise<SupplierServicesMock> {
  const store = new Map((options.services ?? []).map((service) => [service.id, service]));
  const limit = options.limit ?? 30;
  const calls: SupplierServicesMock['calls'] = [];
  let counter = 0;

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: status >= 400 ? 'application/problem+json' : 'application/json', body: JSON.stringify(body) });
  const put = (service: MockService) => {
    const missing = missingFor(service);
    const saved = { ...service, missingForPublication: missing, publishable: missing.length === 0, updatedAt: new Date().toISOString() };
    store.set(saved.id, saved);
    return saved;
  };
  const withContent = (previous: MockService | undefined, body: Partial<MockService>): MockService => ({
    ...(previous ?? mockService({ id: '', status: 'Draft', priceFromCents: null, durationMinutes: null, version: 0, summary: null })),
    ...body,
    photoUrls: body.photoUrls ?? previous?.photoUrls ?? [],
    version: (previous?.version ?? 0) + 1,
  });

  await page.route('**/api/supplier/services**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const parts = url.pathname.split('/').filter(Boolean);
    const at = parts.indexOf('services');
    if (at < 0 || parts[at - 1] !== 'supplier') {
      await route.fallback();
      return;
    }
    const id = parts[at + 1];
    const action = parts[at + 2];
    const isMultipart = (request.headers()['content-type'] ?? '').includes('multipart');
    const body = method === 'POST' || method === 'PUT' ? (isMultipart ? undefined : (request.postDataJSON() as Record<string, unknown> | null)) : undefined;
    calls.push({ method, path: url.pathname.slice(url.pathname.indexOf('/api')), ...(body ? { body } : {}) });

    const notFound = () => json(route, 404, { code: 'supplier_service_not_found', detail: 'Servizio non trovato: potrebbe essere stato eliminato.' });

    if (!id) {
      if (method === 'GET') {
        await json(route, 200, { items: [...store.values()], total: store.size, limit });
        return;
      }
      if (method === 'POST') {
        if (store.size >= limit) {
          await json(route, 422, { code: 'supplier_service_limit_reached', detail: `Puoi avere al massimo ${limit} servizi.` });
          return;
        }
        counter += 1;
        const created = put({ ...withContent(undefined, body as Partial<MockService>), id: `e2e-${counter}`, slug: `servizio-${counter}`, status: 'Draft', version: 1 });
        await json(route, 201, created);
        return;
      }
    }

    const current = id ? store.get(id) : undefined;
    if (id && !current) {
      await notFound();
      return;
    }

    if (current && !action) {
      if (method === 'GET') {
        await json(route, 200, current);
        return;
      }
      if (method === 'PUT') {
        const sent = body as Partial<MockService> & { version?: number };
        if (sent.version !== current.version) {
          await json(route, 409, { code: 'supplier_service_changed', detail: 'Il servizio è stato modificato da un’altra scheda.' });
          return;
        }
        if (sent.photoUrls?.some((photo) => !current.photoUrls.includes(photo))) {
          await json(route, 422, { code: 'supplier_service_invalid', fields: ['photoUrls'] });
          return;
        }
        await json(route, 200, put(withContent(current, sent)));
        return;
      }
      if (method === 'DELETE') {
        store.delete(current.id);
        await route.fulfill({ status: 204 });
        return;
      }
    }

    if (current && method === 'POST') {
      if (action === 'publish') {
        const missing = missingFor(current);
        if (missing.length > 0) {
          await json(route, 422, { code: 'supplier_service_not_publishable', fields: missing, detail: `Manca: ${missing.join(', ')}.` });
          return;
        }
        await json(route, 200, current.status === 'Active' ? current : put({ ...current, status: 'Active', version: current.version + 1 }));
        return;
      }
      if (action === 'pause') {
        if (current.status === 'Draft') {
          await json(route, 422, { code: 'supplier_service_cannot_pause' });
          return;
        }
        await json(route, 200, current.status === 'Paused' ? current : put({ ...current, status: 'Paused', version: current.version + 1 }));
        return;
      }
      if (action === 'duplicate') {
        if (store.size >= limit) {
          await json(route, 422, { code: 'supplier_service_limit_reached' });
          return;
        }
        counter += 1;
        await json(route, 201, put({ ...current, id: `e2e-${counter}`, slug: `${current.slug}-copia`, name: `${current.name} (copia)`, status: 'Draft', version: 1 }));
        return;
      }
      if (action === 'photos') {
        const names = uploadedNames(request.postDataBuffer());
        if (current.photoUrls.length + names.length > 6) {
          await json(route, 422, { code: 'supplier_service_photo_limit_reached', detail: 'Un servizio può avere al massimo 6 foto.' });
          return;
        }
        calls[calls.length - 1] = { ...calls[calls.length - 1]!, body: { files: names } };
        await json(route, 200, put({ ...current, photoUrls: [...current.photoUrls, ...names.map((name) => drawing(name))], version: current.version + 1 }));
        return;
      }
    }

    await route.fallback();
  });

  return {
    services: () => [...store.values()],
    calls,
    touch: (id, changes = {}) => {
      const current = store.get(id);
      if (current) put({ ...current, ...changes, version: current.version + 1 });
    },
  };
}
