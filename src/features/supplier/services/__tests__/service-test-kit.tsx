/* eslint-disable react-refresh/only-export-components -- A helper of the tests: the probe of the address is a component next to the functions the tests call. */
import { StrictMode, type ReactElement } from 'react';
import { vi, type Mock } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { queryClient as appQueryClient } from '@/lib/query-client';
import type { SaveSupplierServiceBody, SupplierService, SupplierServiceList } from '@/types/supplier-services';
import { SERVICE_LIMITS } from '../lib/service-limits';

/** A service as the API answers it: an active one with a fixed price, two photos and a supplement, unless the test says otherwise. */
export function makeService(overrides: Partial<SupplierService> = {}): SupplierService {
  return {
    id: '6f1c9a52-1111-4222-8333-944455556666',
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
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    supplements: [],
    included: [],
    excluded: [],
    photoUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    status: 'Active',
    sortOrder: 0,
    publishable: true,
    missingForPublication: [],
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-12T08:30:00Z',
    version: 3,
    ...overrides,
  };
}

/** A draft that only has a name and a category: what the first step of the creation saves. */
export function makeDraft(overrides: Partial<SupplierService> = {}): SupplierService {
  return makeService({
    id: '0a0a0a0a-2222-4333-8444-555566667777',
    slug: 'ripasso',
    name: 'Ripasso pre-arrivo',
    summary: null,
    priceFromCents: null,
    durationMinutes: null,
    photoUrls: [],
    status: 'Draft',
    publishable: false,
    missingForPublication: ['durationMinutes', 'priceFromCents'],
    version: 1,
    ...overrides,
  });
}

export function listOf(items: SupplierService[], limit = 30): SupplierServiceList {
  return { items, total: items.length, limit };
}

/** A failed call, as axios raises it, with the body of the API (ProblemDetails). */
export function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

/** Where the test is: path and query of the address, for an assertion. */
function Probe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

export interface Routed {
  /** Where the test starts (`/app/supplier/services/new?bozza=…`). */
  at: string;
  /** The pages: the one under test first. Any other address shows its own path, so a test sees where a link went. */
  routes: { path: string; element: ReactElement }[];
  /** Runs the pages under `<StrictMode>`, as the app does in development: the effects run twice. */
  strict?: boolean;
  /** Puts things in the cache before the pages open (a service the person looked at some time ago). */
  seed?: (client: QueryClient) => void;
}

/**
 * The page in a memory router, in Italian, with the cache the app has (a list is fresh for 5 minutes and is not read again when a
 * screen opens it: a test of how a screen behaves with its cache needs that cache) and no retry, so that a refusal is seen at once.
 */
export function renderRouted({ at, routes, strict = false, seed }: Routed) {
  const client = new QueryClient({
    defaultOptions: { queries: { ...appQueryClient.getDefaultOptions().queries, retry: false }, mutations: { retry: false } },
  });
  seed?.(client);
  const tree = (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            {routes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
          </Routes>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
  const view = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { ...view, client };
}

/** The address now, as `/app/supplier/services/new?bozza=…`. */
export const addressNow = (screen: { getByTestId: (id: string) => HTMLElement }) => screen.getByTestId('location').textContent ?? '';

// ─── A catalog that behaves like the API ──────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ['cleaning', 'maintenance', 'plumbing', 'laundry', 'linen', 'check-in', 'gardening', 'events', 'rental', 'excursions', 'electrical'];
const noControl = (text: string) => !/\p{Cc}/u.test(text);

/**
 * The fields the API refuses in a body, named as it names them (`SupplierServiceListingRules.Normalize`): a draft may be
 * incomplete, but whatever it holds has to be valid, a supplement without a name or an amount of 0 included. A fake that took
 * anything would let the tests pass while the real API answers 422.
 */
function invalidFields(body: SaveSupplierServiceBody): string[] {
  const invalid: string[] = [];
  const add = (field: string) => {
    if (!invalid.includes(field)) invalid.push(field);
  };
  const name = body.name.trim();
  if (name === '' || name.length > SERVICE_LIMITS.nameMaxLength || !noControl(name)) add('name');
  if (body.summary && (body.summary.length > SERVICE_LIMITS.summaryMaxLength || !noControl(body.summary))) add('summary');
  if (body.description && body.description.length > SERVICE_LIMITS.descriptionMaxLength) add('description');
  if (body.priceFromCents !== null && (body.priceFromCents < 1 || body.priceFromCents > SERVICE_LIMITS.maxAmountCents)) add('priceFromCents');
  if (body.durationMinutes !== null && (body.durationMinutes < SERVICE_LIMITS.minDurationMinutes || body.durationMinutes > SERVICE_LIMITS.maxDurationMinutes)) {
    add('durationMinutes');
  }
  if (body.minNoticeHours !== null && (body.minNoticeHours < 0 || body.minNoticeHours > SERVICE_LIMITS.maxNoticeHours)) add('minNoticeHours');
  if (body.supplements.length > SERVICE_LIMITS.maxSupplements) add('supplements');
  const codes = new Set<string>();
  body.supplements.forEach((supplement, index) => {
    const path = `supplements[${index}]`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(supplement.code) || supplement.code.length > SERVICE_LIMITS.supplementCodeMaxLength || codes.has(supplement.code)) add(`${path}.code`);
    codes.add(supplement.code);
    if (supplement.label.trim() === '' || supplement.label.length > SERVICE_LIMITS.supplementLabelMaxLength || !noControl(supplement.label)) add(`${path}.label`);
    if (supplement.amountCents < 1 || supplement.amountCents > SERVICE_LIMITS.maxAmountCents) add(`${path}.amountCents`);
    if (supplement.max !== null && supplement.max !== undefined && (supplement.max < 1 || supplement.max > SERVICE_LIMITS.maxSupplementQuantity)) add(`${path}.max`);
  });
  for (const [field, lines] of [['included', body.included], ['excluded', body.excluded]] as const) {
    if (lines.length > SERVICE_LIMITS.maxListItems || lines.some((line) => line.length > SERVICE_LIMITS.listItemMaxLength || !noControl(line))) add(field);
  }
  return invalid;
}

/** What the API does first with a body: a category that is not one of the catalog's is 422 `invalid_service_category`, then the other fields. */
function refuseBody(body: SaveSupplierServiceBody) {
  if (!CATEGORIES.includes(body.category)) throw problem(422, { code: 'invalid_service_category' });
  const invalid = invalidFields(body);
  if (invalid.length > 0) throw problem(422, { code: 'supplier_service_invalid', fields: invalid });
}

function missingFor(service: Pick<SupplierService, 'name' | 'category' | 'durationMinutes' | 'requiresQuote' | 'priceFromCents'>): string[] {
  const missing: string[] = [];
  if (service.name.trim() === '') missing.push('name');
  if (service.category.trim() === '') missing.push('category');
  if (!service.durationMinutes || service.durationMinutes <= 0) missing.push('durationMinutes');
  if (!service.requiresQuote && !(service.priceFromCents && service.priceFromCents > 0)) missing.push('priceFromCents');
  return missing;
}

/**
 * The catalog of a supplier in memory, with the rules the tests depend on: a save carries the `version` the last answer had
 * (another is a 409, `supplier_service_changed`), the photos stay unless the body carries them and can only be taken away or
 * reordered, publishing needs name, category, duration and a price or a quote (422 with `fields`), at most 6 photos.
 * Everything that changes a service bumps its version, as the API does.
 */
export function createFakeCatalog(initial: SupplierService[] = [], limit = 30) {
  const store = new Map(initial.map((service) => [service.id, service]));
  let counter = 0;
  const notFound = (id: string) => problem(404, { code: 'supplier_service_not_found', detail: `Servizio ${id} non trovato.` });
  const get = (id: string) => {
    const service = store.get(id);
    if (!service) throw notFound(id);
    return service;
  };
  const put = (service: SupplierService) => {
    const complete = { ...service, missingForPublication: missingFor(service) };
    const saved = { ...complete, publishable: complete.missingForPublication.length === 0 };
    store.set(saved.id, saved);
    return saved;
  };
  const withContent = (previous: SupplierService | undefined, body: SaveSupplierServiceBody): SupplierService => ({
    ...(previous ?? makeDraft({ photoUrls: [] })),
    name: body.name,
    category: body.category,
    summary: body.summary,
    description: body.description,
    priceFromCents: body.priceFromCents,
    priceUnit: body.priceUnit,
    pricesIncludeVat: body.pricesIncludeVat,
    requiresQuote: body.requiresQuote,
    durationMinutes: body.durationMinutes,
    minNoticeHours: body.minNoticeHours,
    weekdays: body.weekdays,
    supplements: body.supplements,
    included: body.included,
    excluded: body.excluded,
    photoUrls: body.photoUrls ?? previous?.photoUrls ?? [],
    version: (previous?.version ?? 0) + 1,
  });

  const catalog = {
    /** The services as they are now. */
    items: () => [...store.values()],
    /** What the API would answer to a `GET` of the list. */
    list: () => listOf([...store.values()], limit),
    /** Changes a service behind the back of the screen (another tab, another user): its version moves on. */
    touch: (id: string, changes: Partial<SupplierService> = {}) => put({ ...get(id), ...changes, version: get(id).version + 1 }),
    fetchList: vi.fn(async () => catalog.list()),
    fetchOne: vi.fn(async (id: string) => get(id)),
    create: vi.fn(async (body: SaveSupplierServiceBody) => {
      refuseBody(body);
      if (store.size >= limit) throw problem(422, { code: 'supplier_service_limit_reached' });
      counter += 1;
      return put({ ...withContent(undefined, body), id: `new-${counter}`, slug: `servizio-${counter}`, status: 'Draft', version: 1 });
    }),
    update: vi.fn(async (id: string, body: SaveSupplierServiceBody & { version: number }) => {
      const previous = get(id);
      if (body.version !== previous.version) throw problem(409, { code: 'supplier_service_changed' });
      refuseBody(body);
      const missing = missingFor({ ...previous, ...body });
      if (previous.status === 'Active' && missing.length > 0) throw problem(422, { code: 'supplier_service_not_publishable', fields: missing });
      if (body.photoUrls?.some((url) => !previous.photoUrls.includes(url))) throw problem(422, { code: 'supplier_service_invalid', fields: ['photoUrls'] });
      return put(withContent(previous, body));
    }),
    publish: vi.fn(async (id: string) => {
      const previous = get(id);
      const missing = missingFor(previous);
      if (missing.length > 0) throw problem(422, { code: 'supplier_service_not_publishable', fields: missing });
      return previous.status === 'Active' ? previous : put({ ...previous, status: 'Active', version: previous.version + 1 });
    }),
    pause: vi.fn(async (id: string) => {
      const previous = get(id);
      if (previous.status === 'Draft') throw problem(422, { code: 'supplier_service_cannot_pause' });
      return previous.status === 'Paused' ? previous : put({ ...previous, status: 'Paused', version: previous.version + 1 });
    }),
    duplicate: vi.fn(async (id: string) => {
      const previous = get(id);
      if (store.size >= limit) throw problem(422, { code: 'supplier_service_limit_reached' });
      counter += 1;
      return put({ ...previous, id: `copy-${counter}`, slug: `${previous.slug}-copia`, name: `${previous.name} (copia)`, status: 'Draft', version: 1 });
    }),
    remove: vi.fn(async (id: string) => {
      get(id);
      store.delete(id);
    }),
    upload: vi.fn(async (id: string, files: File[]) => {
      const previous = get(id);
      if (previous.photoUrls.length + files.length > 6) throw problem(422, { code: 'supplier_service_photo_limit_reached', detail: 'Un servizio può avere al massimo 6 foto.' });
      return put({ ...previous, photoUrls: [...previous.photoUrls, ...files.map((file) => `https://cdn.example/${id}/${file.name}`)], version: previous.version + 1 });
    }),
  };
  return catalog;
}

/** The functions of `@/api/supplier-services.api`, as mocks the test declared with `vi.hoisted`, answered by a fake catalog. */
export interface ServicesApiMocks {
  fetchSupplierServices: Mock;
  fetchSupplierService: Mock;
  createSupplierService: Mock;
  updateSupplierService: Mock;
  deleteSupplierService: Mock;
  publishSupplierService: Mock;
  pauseSupplierService: Mock;
  duplicateSupplierService: Mock;
  uploadSupplierServicePhotos: Mock;
}

export function connectApi(api: ServicesApiMocks, catalog: ReturnType<typeof createFakeCatalog>) {
  api.fetchSupplierServices.mockImplementation(catalog.fetchList);
  api.fetchSupplierService.mockImplementation(catalog.fetchOne);
  api.createSupplierService.mockImplementation(catalog.create);
  api.updateSupplierService.mockImplementation(catalog.update);
  api.deleteSupplierService.mockImplementation(catalog.remove);
  api.publishSupplierService.mockImplementation(catalog.publish);
  api.pauseSupplierService.mockImplementation(catalog.pause);
  api.duplicateSupplierService.mockImplementation(catalog.duplicate);
  api.uploadSupplierServicePhotos.mockImplementation(catalog.upload);
}
