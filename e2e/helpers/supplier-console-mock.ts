import type { Page } from '@playwright/test';
import { mockComuniApi } from './properties-api-mock';
import { mockServiceCategoriesApi } from './service-categories-mock';

interface SupplierProfile {
  orgId: string;
  status: string;
  legalName: string;
  phone: string;
  email: string;
  categories: string[];
  comuni: string[];
  /** Comuni chosen from the official ISTAT list (SU-04). */
  comuneIstatCodes?: string[];
  bio?: string | null;
  photoUrls: string[];
  tosAcceptedAt?: string | null;
}

interface ActivationStep {
  id: string;
  status: 'completed' | 'pending';
  blocker: string | null;
  required: boolean;
}

interface ActivationStatus {
  status: string;
  currentStep: number;
  steps: ActivationStep[];
  tos: {
    currentVersion: string;
    acceptedVersion: string | null;
    acceptedAt: string | null;
    reacceptanceRequired: boolean;
    blocksActions: boolean;
  };
}

const MOCK_TOS_VERSION = '2026-10-v1';

/** What the API derives from the stored profile (SU-05): the requirements of each wizard step. */
function activationOf(profile: SupplierProfile, savedStep: number | null): ActivationStatus {
  const step = (id: string, blocker: string | null, required = true): ActivationStep => ({
    id,
    status: blocker === null && (required || profile.photoUrls.length > 0) ? 'completed' : 'pending',
    blocker,
    required,
  });
  const steps = [
    step('identity', profile.legalName && profile.phone ? null : 'legal_name_missing'),
    step('services', profile.categories.length === 0 ? 'categories_missing' : profile.comuni.length === 0 && (profile.comuneIstatCodes ?? []).length === 0 ? 'comuni_missing' : null),
    step('showcase', null, false),
    step('profile', profile.bio ? null : 'bio_missing'),
    step('terms', profile.tosAcceptedAt ? null : 'tos_not_accepted'),
  ];
  const firstIncomplete = steps.findIndex((s) => s.required && s.status === 'pending');
  return {
    status: profile.status,
    currentStep: savedStep ?? (firstIncomplete >= 0 ? firstIncomplete + 1 : 5),
    steps,
    tos: {
      currentVersion: MOCK_TOS_VERSION,
      acceptedVersion: profile.tosAcceptedAt ? MOCK_TOS_VERSION : null,
      acceptedAt: profile.tosAcceptedAt ?? null,
      reacceptanceRequired: false,
      blocksActions: false,
    },
  };
}

const demoSupplierProfile: SupplierProfile = {
  orgId: '22222222-2222-2222-2222-222222222202',
  status: 'Pending',
  legalName: 'Pulizie Demo Srl',
  phone: '+39 06 1234567',
  email: 'supplier@demo.casazen.com',
  categories: [],
  comuni: [],
  bio: null,
  photoUrls: [],
  tosAcceptedAt: null,
};

interface InboxItem {
  id: string;
  status: string;
  propertyName?: string;
  serviceCategory?: string;
  requestedAt?: string;
}

export async function mockSupplierConsoleApi(
  page: Page,
  options?: { active?: boolean; inboxItems?: InboxItem[] },
): Promise<void> {
  const active = options?.active ?? false;
  const inboxItems = options?.inboxItems ?? [];
  // Stateful like the API: what the wizard saves is what the next read returns (SU-05).
  let profile: SupplierProfile = active
    ? { ...demoSupplierProfile, status: 'Active', categories: ['cleaning'], comuni: ['H501'], bio: 'Servizi demo', tosAcceptedAt: new Date().toISOString() }
    : { ...demoSupplierProfile };
  let savedStep: number | null = null;

  await mockServiceCategoriesApi(page);
  await mockComuniApi(page);

  await page.route('**/api/supplier/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/profile/activation/step') && method === 'PUT') {
      savedStep = (route.request().postDataJSON() as { step: number }).step;
      await route.fulfill({ status: 204 });
      return;
    }

    if (url.includes('/profile/activation/complete') && method === 'POST') {
      const body = route.request().postDataJSON() as { tosAccepted: boolean; tosVersion: string };
      const blockers = activationOf(profile, savedStep).steps.filter((s) => s.required && s.blocker && s.id !== 'terms');
      if (!body.tosAccepted || blockers.length > 0) {
        await route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          body: JSON.stringify({ code: 'supplier_activation_blocked', blockers: blockers.map((s) => s.blocker) }),
        });
        return;
      }
      profile = { ...profile, status: 'Active', tosAcceptedAt: new Date().toISOString() };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'Active' }) });
      return;
    }

    if (url.includes('/profile/activation') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activationOf(profile, savedStep)) });
      return;
    }

    if (url.includes('/profile') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
      return;
    }

    if (url.includes('/profile') && method === 'PUT') {
      const body = route.request().postDataJSON() as Partial<SupplierProfile>;
      profile = {
        ...profile,
        ...body,
        categories: body.categories ?? profile.categories,
        comuni: body.comuni ?? profile.comuni,
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
      return;
    }

    if (url.includes('/inbox')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: inboxItems, total: inboxItems.length }),
      });
      return;
    }

    if (url.includes('/availability') && method === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated: 1 }) });
      return;
    }

    if (url.includes('/dashboard/kpis')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: 'CurrentMonth',
          from: '2026-09-01',
          to: '2026-09-25',
          timeZone: 'Europe/Rome',
          completed: active ? 3 : 0,
          rejected: 0,
          awaitingAcceptance: active ? 1 : 0,
          upcoming: active ? 2 : 0,
          totalRequests: active ? 6 : 0,
        }),
      });
      return;
    }

    if (url.includes('/dashboard')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profileCompletionPercent: active ? 100 : 40,
          status: active ? 'Active' : 'Pending',
          availabilityRate: active ? 0.8 : 0,
          calendarSyncStatus: {
            calendarSyncType: 'None',
            icalFeedUrl: null,
            calendarLastSyncAt: null,
            calendarSyncError: null,
          },
          lastUpdated: new Date().toISOString(),
        }),
      });
      return;
    }

    if (url.includes('/calendar/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          calendarSyncType: 'None',
          icalFeedUrl: null,
          calendarLastSyncAt: null,
          calendarSyncError: null,
        }),
      });
      return;
    }

    if (url.includes('/calendar/ical') && method === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          calendarSyncType: 'ICalFeed',
          icalFeedUrl: 'https://example.com/ical',
          calendarLastSyncAt: new Date().toISOString(),
          calendarSyncError: null,
        }),
      });
      return;
    }

    if (url.includes('/profile/photos') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ urls: [...profile.photoUrls, '/uploads/suppliers/demo/photo1.jpg'] }),
      });
      return;
    }

    await route.continue();
  });
}
