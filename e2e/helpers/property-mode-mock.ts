import type { Page, Route } from '@playwright/test';

/**
 * L2 mock of the change of rental mode (PM-02, flag `propertyModeChange`): the four endpoints of
 * `/api/properties/{id}/mode`, stateful like the server (one change at a time, withdrawn or programmed), plus the flag of
 * `GET /api/public/features`. The day of the preview is worked out from the clock of the machine, in Rome, as the product does.
 */

const UTC_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
const ROME_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today in Rome (`2026-10-16`). */
export function romeToday(): string {
  return ROME_DAY.format(new Date());
}

/** `day` moved by `days` calendar days. */
export function plusDays(day: string, days: number): string {
  return UTC_DAY.format(new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000));
}

type Mode = 'Short' | 'Long';

interface MockChange {
  id: string;
  propertyId: string;
  fromMode: Mode;
  toMode: Mode;
  effectiveDate: string;
  status: 'Scheduled' | 'Cancelled';
  createdAt: string;
  appliedAt: null;
  cancelledAt: string | null;
  failedAt: null;
  failureReason: null;
}

export interface PropertyModeMockOptions {
  propertyId: string;
  /** The mode the property is in. */
  rentalMode?: Mode;
  /** `false` leaves the flag off: the app must show nothing of the feature. */
  flag?: boolean;
  /** A change that already waits for its day. */
  scheduledFor?: string;
}

export interface PropertyModeMock {
  /** The bodies of the `POST .../mode/change` the page sent. */
  schedules: Array<{ to: string; effectiveDate: string }>;
  /** The ids of the changes withdrawn. */
  cancels: string[];
  /** The last day a stay (to long-term) or a lease (to short stays) stands in the way of; `null` when nothing does. */
  busyUntil: string | null;
  /** Requests to the mode endpoints of any kind: with the flag off it must stay at zero. */
  requests: number;
}

/** Installs the mock; call it after `mockPropertiesApi` (the property itself) and before opening the page. */
export async function mockPropertyModeApi(page: Page, options: PropertyModeMockOptions): Promise<PropertyModeMock> {
  const { propertyId, flag = true } = options;
  const mode: Mode = options.rentalMode ?? 'Short';
  const target: Mode = mode === 'Short' ? 'Long' : 'Short';
  const mock: PropertyModeMock = { schedules: [], cancels: [], busyUntil: null, requests: 0 };
  let scheduled: MockChange | null = options.scheduledFor
    ? {
        id: 'change-e2e-0',
        propertyId,
        fromMode: mode,
        toMode: target,
        effectiveDate: options.scheduledFor,
        status: 'Scheduled',
        createdAt: new Date().toISOString(),
        appliedAt: null,
        cancelledAt: null,
        failedAt: null,
        failureReason: null,
      }
    : null;
  let last: MockChange | null = null;

  await page.route('**/api/public/features', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ otaPartnerApi: false, propertyModeChange: flag }),
    });
  });

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });

  await page.route(`**/api/properties/${propertyId}/mode**`, async (route) => {
    mock.requests += 1;
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'GET' && path.endsWith('/mode/preview')) {
      const today = romeToday();
      const tomorrow = plusDays(today, 1);
      const freeFrom = mock.busyUntil ? plusDays(mock.busyUntil, 1) : null;
      const earliest = freeFrom && freeFrom > tomorrow ? freeFrom : tomorrow;
      const date = url.searchParams.get('date') || earliest;
      const blocked = mock.busyUntil !== null && date <= mock.busyUntil;
      const blockers = blocked
        ? [
            {
              kind: mode === 'Short' ? 'Stay' : 'Lease',
              id: mode === 'Short' ? 'stay-e2e-1' : 'lease-e2e-1',
              start: plusDays(mock.busyUntil!, -4),
              end: mock.busyUntil,
              freeFrom,
              status: mode === 'Short' ? 'Confirmed' : 'Registered',
              source: mode === 'Short' ? 'Direct' : null,
            },
          ]
        : [];
      const issues = [
        ...(scheduled ? ['property_mode_change_exists'] : []),
        ...(date < tomorrow ? ['property_mode_date_too_early'] : []),
        ...(blocked ? [mode === 'Short' ? 'property_mode_blocked_by_bookings' : 'property_mode_blocked_by_lease'] : []),
      ];
      await json(route, 200, {
        propertyId,
        currentMode: mode,
        targetMode: target,
        today,
        earliestDate: earliest,
        date,
        canSchedule: issues.length === 0,
        issues,
        blockers,
        calendarClosedUntil: target === 'Long' ? plusDays(date, 730) : null,
        scheduledChange: scheduled,
      });
      return;
    }

    if (method === 'GET' && path.endsWith('/mode')) {
      await json(route, 200, { propertyId, rentalMode: mode, scheduledChange: scheduled, lastChange: last });
      return;
    }

    if (method === 'POST' && path.endsWith('/mode/change')) {
      const body = request.postDataJSON() as { to: string; effectiveDate: string };
      mock.schedules.push(body);
      if (scheduled) {
        await json(route, 409, { status: 409, code: 'property_mode_change_exists' });
        return;
      }
      scheduled = {
        id: `change-e2e-${mock.schedules.length}`,
        propertyId,
        fromMode: mode,
        toMode: body.to as Mode,
        effectiveDate: body.effectiveDate,
        status: 'Scheduled',
        createdAt: new Date().toISOString(),
        appliedAt: null,
        cancelledAt: null,
        failedAt: null,
        failureReason: null,
      };
      await json(route, 201, scheduled);
      return;
    }

    if (method === 'DELETE' && /\/mode\/change\/[^/]+$/.test(path)) {
      const id = path.split('/').pop()!;
      if (!scheduled || scheduled.id !== id) {
        await json(route, 409, { status: 409, code: 'property_mode_change_not_scheduled' });
        return;
      }
      mock.cancels.push(id);
      last = { ...scheduled, status: 'Cancelled', cancelledAt: new Date().toISOString() };
      scheduled = null;
      await json(route, 204, undefined);
      return;
    }

    await route.fallback();
  });

  return mock;
}
