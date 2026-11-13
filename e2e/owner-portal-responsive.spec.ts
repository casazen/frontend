import type { Page, Route } from '@playwright/test';
import { expect, test } from './test';
import { pinE2eLocale } from './helpers/locale';
import { expectNoAxeViolations, expectNothingSticksOut } from './helpers/ui-checks';

/**
 * The owner portal on a phone and on a desktop (E07/F07/US01/T03, NF-111, AC-NF111-6): the four widths of the brief, 390x844 and 360x740 (phones), 768 (tablet) and 1280
 * (desktop). On every page of the portal: nothing makes the page scroll sideways, every button, link and field is at least 44 px high, nothing fixed sits on a button, the
 * lists are cards (no table), and axe (colors and names included) finds nothing. The menu is reached with the keyboard in the order the eye reads it, with a visible focus.
 * The API is the demo stack: `page.route` stands in for the backend.
 */

const VIEWPORTS = [
  { name: 'phone 390', width: 390, height: 844 },
  { name: 'small phone 360', width: 360, height: 740 },
  { name: 'tablet 768', width: 768, height: 1024 },
  { name: 'desktop 1280', width: 1280, height: 800 },
] as const;

/** A day `offset` days from today, `yyyy-MM-dd`. */
function day(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

const PROPERTY = {
  propertyId: 'prop-1',
  propertyName: 'Casa Mare con un nome molto lungo per vedere che va a capo',
  address: 'Via del Mare 1, Rimini',
  totalBookings: 4,
  totalRevenue: 4200,
  occupancyRate: 61.5,
  recentBookings: [{ bookingId: 'b1', checkInDate: '2026-10-01T00:00:00Z', checkOutDate: '2026-10-05T00:00:00Z', channel: 'Booking.com', totalAmount: 480, status: 'Confirmed' }],
};

function stay(state: string, status: string, id: string) {
  return {
    id,
    orgId: 'org-1',
    propertyId: 'prop-1',
    propertyName: PROPERTY.propertyName,
    propertyOwnerId: 'po-1',
    startDate: day(40),
    endDate: day(44),
    nights: 4,
    status,
    state,
    syncState: 'Pending',
    releaseSyncState: 'None',
    requestedAt: '2026-11-10T10:00:00Z',
    requestedByContact: false,
  };
}

const RULE = {
  rule: { propertyId: 'prop-1', minAdvanceDays: 14, maxAdvanceDays: 365, minNights: 2, maxNights: 21, yearlyNightAllowance: 30, approvalRequired: true, blackouts: [{ from: day(100), to: day(110) }] },
  year: 2026,
  nightsUsed: 4,
  nightsRemaining: 26,
};

const DOCUMENTS = {
  documents: [
    {
      id: 'doc-1',
      orgId: 'org-1',
      propertyOwnerId: 'po-1',
      propertyId: 'prop-1',
      propertyName: PROPERTY.propertyName,
      type: 'Mandate',
      title: 'Mandato di gestione con un titolo molto lungo che deve andare a capo senza uscire dallo schermo',
      expiryState: 'expiring',
      expiresOn: day(20),
      updatedAt: '2026-11-01T10:00:00Z',
      versions: [
        { id: 'ver-2', versionNumber: 2, fileName: 'mandato.pdf', contentType: 'application/pdf', sizeBytes: 20480, sha256: 'a', effectiveFrom: day(-30), expiresOn: day(20), state: 'current', uploadedAt: '2026-11-01T10:00:00Z' },
        { id: 'ver-1', versionNumber: 1, fileName: 'mandato-1.pdf', contentType: 'application/pdf', sizeBytes: 10240, sha256: 'b', state: 'superseded', uploadedAt: '2026-01-01T10:00:00Z' },
      ],
    },
  ],
  statements: [
    { statementVersionId: 'sv-1', orgId: 'org-1', propertyOwnerId: 'po-1', periodYear: 2026, periodMonth: 10, versionNumber: 2, status: 'Published', publishedAt: '2026-11-02T09:00:00Z' },
    { statementVersionId: 'sv-0', orgId: 'org-1', propertyOwnerId: 'po-1', periodYear: 2026, periodMonth: 10, versionNumber: 1, status: 'Superseded', publishedAt: '2026-11-01T09:00:00Z' },
  ],
};

const CONTACT = {
  id: 'contact-1',
  orgId: 'org-1',
  propertyOwnerId: 'po-1',
  email: 'anna.verdi.con.un.indirizzo.molto.lungo@example.com',
  firstName: 'Anna',
  lastName: 'Verdi',
  permissions: ['calendar.read', 'inbox.use'],
  status: 'active',
  createdAt: '2026-11-01T10:00:00Z',
  invitationExpiresAt: '2026-11-08T10:00:00Z',
};

const CONVERSATION = {
  id: 'conv-1',
  orgId: 'org-1',
  propertyOwnerId: 'po-1',
  topic: 'Document',
  documentId: 'doc-1',
  subject: 'Scadenza del mandato e del rinnovo, con un oggetto lungo che deve andare a capo',
  createdAt: '2026-11-05T10:00:00Z',
  lastMessageAt: '2026-11-06T10:00:00Z',
};

const MESSAGES = [
  { id: 'm1', conversationId: 'conv-1', sender: 'Owner', authorName: 'Maria Bianchi', body: 'Quando scade il mandato?', createdAt: '2026-11-05T10:00:00Z' },
  {
    id: 'm2',
    conversationId: 'conv-1',
    sender: 'Agency',
    authorName: 'Agenzia',
    body: 'Il mandato scade tra venti giorni, ti mandiamo il rinnovo.',
    attachment: { fileName: 'rinnovo-mandato-con-un-nome-di-file-molto-lungo.pdf', contentType: 'application/pdf', sizeBytes: 30000 },
    createdAt: '2026-11-06T10:00:00Z',
  },
];

function calendar() {
  return {
    propertyId: 'prop-1',
    from: day(0),
    to: day(90),
    ranges: [
      { start: day(0), end: day(10), kind: 'available' },
      { start: day(10), end: day(14), kind: 'occupied' },
      { start: day(14), end: day(30), kind: 'available' },
      { start: day(40), end: day(44), kind: 'ownerStay', stayId: 'stay-1', stayState: 'requested' },
      { start: day(50), end: day(55), kind: 'blocked' },
    ],
  };
}

async function mockOwnerPortal(page: Page) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route((url) => url.pathname.startsWith('/api/owner-portal/'), async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname.endsWith('/properties')) return json(route, [PROPERTY]);
    if (pathname.endsWith('/calendar')) return json(route, calendar());
    if (pathname.endsWith('/stays/rule')) return json(route, RULE);
    if (pathname.endsWith('/stays') && method === 'POST') return json(route, stay('requested', 'Requested', 'stay-new'), 201);
    if (pathname.endsWith('/stays')) {
      return json(route, [stay('requested', 'Requested', 'stay-1'), stay('approved_syncing', 'Approved', 'stay-2'), stay('confirmed', 'Approved', 'stay-3'), stay('sync_failed', 'Approved', 'stay-4')]);
    }
    if (pathname.endsWith('/external-documents')) {
      return json(route, [{ id: 'inv-1', statementVersionId: 'sv-1', externalNumber: '2026/114', externalDate: '2026-11-03', documentUrl: 'https://fatture.example.com/f/114', status: 'Verified' }]);
    }
    if (pathname.endsWith('/documents')) return json(route, DOCUMENTS);
    if (pathname.endsWith('/contacts')) return json(route, [CONTACT]);
    if (pathname.endsWith('/conversations/conv-1/messages')) return json(route, MESSAGES);
    if (pathname.endsWith('/conversations')) return json(route, [CONVERSATION]);
    if (pathname.endsWith('/inbox/preferences')) return json(route, { emailNotifications: true });
    return route.fallback();
  });
}

const PAGES = [
  { name: 'calendar and stays', path: '/portale-proprietari/calendario/prop-1', ready: 'owner-stays' },
  { name: 'accounting', path: '/portale-proprietari/contabilita', ready: 'owner-statements' },
  { name: 'documents', path: '/portale-proprietari/documenti', ready: 'owner-documents' },
  { name: 'messages', path: '/portale-proprietari/messaggi', ready: 'owner-conversations' },
  { name: 'a conversation', path: '/portale-proprietari/messaggi/conv-1', ready: 'owner-messages' },
  { name: 'contacts', path: '/portale-proprietari/contatti', ready: 'owner-contacts' },
  { name: 'a property', path: '/portale-proprietari/immobili/prop-1', ready: 'owner-recent-bookings' },
] as const;

/** Every button, link and field a person touches is at least 44 px high, on any device and whatever the pointer. */
async function expectTouchTargets(page: Page, where: string) {
  const small = await page.evaluate(() => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !element.closest('.sr-only, [hidden]');
    };
    const selector = [
      'header a',
      'header button',
      'main a[href]',
      'main button',
      'main select',
      'main textarea',
      'main summary',
      'main input:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      'main label:has(input[type="checkbox"])',
    ].join(',');
    return Array.from(document.querySelectorAll(selector))
      .filter(visible)
      .map((element) => ({ name: (element.textContent ?? element.getAttribute('aria-label') ?? element.tagName).trim().slice(0, 40), height: Math.round(element.getBoundingClientRect().height * 10) / 10 }))
      .filter((target) => target.height < 43.5);
  });
  expect(small, `${where}: every target is at least 44 px high`).toEqual([]);
}

/** Nothing sits on a button: the element at the middle of each one (scrolled into view) is the button itself or something inside it. */
async function expectNothingCoversAButton(page: Page, where: string) {
  const covered = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('main button, main a[href]')).filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && !element.closest('.sr-only, [hidden]');
    });
    const found: string[] = [];
    for (const button of buttons) {
      button.scrollIntoView({ block: 'center' });
      const box = button.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (hit && !button.contains(hit) && !hit.contains(button)) found.push(`${(button.textContent ?? '').trim().slice(0, 30)} is under <${hit.tagName.toLowerCase()}>`);
    }
    window.scrollTo(0, 0);
    return found;
  });
  expect(covered, `${where}: nothing covers a button`).toEqual([]);
}

test.describe('Owner portal: phones, tablet and desktop (E07/F07/US01/T03)', () => {
  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
    await mockOwnerPortal(page);
  });

  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const portalPage of PAGES) {
        test(`${portalPage.name}: nothing sticks out, every target is 44 px, nothing covers a button, no table, axe is clean`, async ({ page }) => {
          await page.goto(portalPage.path, { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expect(page.getByTestId(portalPage.ready)).toBeVisible();

          await expectNothingSticksOut(page, `${portalPage.name} at ${viewport.width}`);
          await expectTouchTargets(page, `${portalPage.name} at ${viewport.width}`);
          await expectNothingCoversAButton(page, `${portalPage.name} at ${viewport.width}`);
          // The lists are cards: nothing to scroll sideways inside the page.
          await expect(page.locator('main table')).toHaveCount(0);
          await expectNoAxeViolations(page);
        });
      }

      test('the menu is reached with the keyboard in the order of the eye, with a visible focus', async ({ page }) => {
        await page.goto('/portale-proprietari/documenti', { waitUntil: 'domcontentloaded' });
        const nav = page.getByRole('navigation', { name: 'Portale proprietari' });
        await expect(nav.getByRole('link', { name: 'Contatti', exact: true })).toBeVisible();

        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Vai al contenuto' })).toBeFocused();
        for (const name of ['Panoramica', 'Immobili e calendario', 'Contabilità', 'Documenti', 'Messaggi', 'Contatti']) {
          await page.keyboard.press('Tab');
          const link = nav.getByRole('link', { name, exact: true });
          await expect(link).toBeFocused();
          const ring = await link.evaluate((element) => {
            const style = getComputedStyle(element);
            return style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0);
          });
          expect(ring, `${name} shows where the focus is`).toBe(true);
        }
        await page.keyboard.press('Tab');
        await expect(page.getByTestId('owner-sign-out')).toBeFocused();

        // Enter on a link of the menu opens its page.
        await nav.getByRole('link', { name: 'Messaggi', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/portale-proprietari\/messaggi$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Messaggi' })).toBeVisible();
      });
    });
  }

  test.describe('a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('a stay is asked for from the phone and reads as a request, never as a confirmed stay', async ({ page }) => {
      await page.goto('/portale-proprietari/calendario/prop-1', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-stay-rule')).toContainText('Almeno 14 giorni di preavviso');
      await page.getByTestId('owner-stay-start').fill(day(60));
      await page.getByTestId('owner-stay-end').fill(day(64));
      await page.getByTestId('owner-stay-submit').click();

      const sent = page.getByTestId('owner-stay-sent');
      await expect(sent).toContainText('Richiesta inviata');
      await expect(sent).toContainText('Non è ancora un soggiorno confermato');
      await expect(sent).not.toContainText('Confermato');
      // An approved stay whose dates are not blocked yet is not «confirmed» either.
      await expect(page.locator('[data-testid="owner-stay"][data-state="approved_syncing"]')).toContainText('non è ancora confermato');
      await expect(page.locator('[data-testid="owner-stay"][data-state="sync_failed"]')).toContainText('Non è confermato');
    });

    test('nothing of a guest is on the calendar and a statement that is not published is not on the accounting page', async ({ page }) => {
      await page.goto('/portale-proprietari/calendario/prop-1', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-calendar-runs')).toContainText('Occupato');
      await expect(page.getByTestId('owner-calendar')).not.toContainText(/@|Airbnb|Booking\.com|ospite/i);

      await page.goto('/portale-proprietari/contabilita', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-statements')).toBeVisible();
      await expect(page.getByTestId('owner-accounting-note')).toContainText('non sono ancora mostrati');
      await expect(page.locator('main')).not.toContainText(/\b(pagat[oaie]|inviat[oaie]|accettat[oaie])\b/i);
    });
  });
});
