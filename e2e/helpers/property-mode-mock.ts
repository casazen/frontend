import type { Page, Route } from '@playwright/test';
import { addDays, todayInRome } from '../../src/lib/stay-dates';
import type { RentalMode } from '../../src/types/property.types';
import type {
  PropertyModeBlocker,
  PropertyModeChange,
  PropertyModePreview,
  PropertyModeState,
  SchedulePropertyModeChangeDto,
} from '../../src/types/property-mode.types';

/**
 * L2 mock of the change of rental mode (PM-02, flag `propertyModeChange`): the four endpoints of
 * `/api/properties/{id}/mode`, stateful like the server (one change at a time, withdrawn or programmed), plus the flag of
 * `GET /api/public/features`. The day of the preview is worked out from the clock of the machine, in Rome, as the product does.
 */

type Mode = RentalMode;

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
  schedules: SchedulePropertyModeChangeDto[];
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
  const aChange = (id: string, toMode: Mode, effectiveDate: string): PropertyModeChange => ({
    id,
    propertyId,
    fromMode: mode,
    toMode,
    effectiveDate,
    status: 'Scheduled',
    createdAt: new Date().toISOString(),
    appliedAt: null,
    cancelledAt: null,
    failedAt: null,
    failureReason: null,
  });
  let scheduled: PropertyModeChange | null = options.scheduledFor ? aChange('change-e2e-0', target, options.scheduledFor) : null;
  let last: PropertyModeChange | null = null;

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
      const today = todayInRome();
      const tomorrow = addDays(today, 1);
      const busyUntil = mock.busyUntil;
      const freeFrom = busyUntil ? addDays(busyUntil, 1) : null;
      const earliest = freeFrom && freeFrom > tomorrow ? freeFrom : tomorrow;
      const date = url.searchParams.get('date') || earliest;
      const blocked = busyUntil !== null && date <= busyUntil;
      const blockers: PropertyModeBlocker[] =
        busyUntil !== null && blocked
          ? [
              {
                kind: mode === 'Short' ? 'Stay' : 'Lease',
                id: mode === 'Short' ? 'stay-e2e-1' : 'lease-e2e-1',
                start: addDays(busyUntil, -4),
                end: busyUntil,
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
      const answer: PropertyModePreview = {
        propertyId,
        currentMode: mode,
        targetMode: target,
        today,
        earliestDate: earliest,
        date,
        canSchedule: issues.length === 0,
        issues,
        blockers,
        calendarClosedUntil: target === 'Long' ? addDays(date, 730) : null,
        scheduledChange: scheduled,
      };
      await json(route, 200, answer);
      return;
    }

    if (method === 'GET' && path.endsWith('/mode')) {
      const answer: PropertyModeState = { propertyId, rentalMode: mode, scheduledChange: scheduled, lastChange: last };
      await json(route, 200, answer);
      return;
    }

    if (method === 'POST' && path.endsWith('/mode/change')) {
      const body = request.postDataJSON() as SchedulePropertyModeChangeDto;
      mock.schedules.push(body);
      if (scheduled) {
        await json(route, 409, { status: 409, code: 'property_mode_change_exists' });
        return;
      }
      scheduled = aChange(`change-e2e-${mock.schedules.length}`, body.to, body.effectiveDate);
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
