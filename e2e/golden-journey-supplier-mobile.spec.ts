import { readFileSync, existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { readAccessToken } from './helpers/auth';
import { e2eEnv } from './helpers/env';

const isLocalL3 = process.env.E2E_LOCAL === '1' || process.env.E2E_STAGING === '1';
const API = process.env.E2E_LOCAL_API_URL ?? 'http://localhost:5000/api';

type GjSeed = {
  bookingId?: string;
  propertyId?: string;
  supplierOrgId?: string;
};

/**
 * AC13 — F1–F2 supplier mobile web on a real API.
 * Uses the host Auth0 session (dual-role after L3) and must take + complete a Richiesto SR.
 */
test.describe('Golden Journey supplier mobile (AC13 F1–F2)', () => {
  test.skip(!isLocalL3, 'Set E2E_LOCAL=1 against the real local API');
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(180_000);

  test('F1–F2 inbox take and complete on phone viewport', async ({ page, request }) => {
    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/short-rent');
    const token = await readAccessToken(page);
    expect(token, 'host access token for supplier inbox').toBeTruthy();
    const auth = { Authorization: `Bearer ${token}` };

    let seed: GjSeed = {};
    if (existsSync('e2e/.auth/gj-seed.json')) {
      seed = JSON.parse(readFileSync('e2e/.auth/gj-seed.json', 'utf8')) as GjSeed;
    }

    const profileGet = await request.get(`${API}/supplier/profile`, { headers: auth });
    if (profileGet.status() !== 200) {
      const link = await request.post(`${API}/suppliers/register`, {
        headers: auth,
        data: {
          email: e2eEnv.auth0Email,
          legalName: `GJ F12 Supplier ${Date.now()}`,
          phone: '+390612345678',
          comuneCode: '058091',
        },
      });
      expect([200, 201], 'F1 supplier link').toContain(link.status());
      await request.put(`${API}/supplier/profile`, {
        headers: auth,
        data: { categories: ['cleaning'], comuni: ['058091'], bio: 'F1–F2' },
      });
      await request.post(`${API}/supplier/profile/activation/complete`, {
        headers: auth,
        data: { tosAccepted: true },
      });
    }

    const profile = await request.get(`${API}/supplier/profile`, { headers: auth });
    expect(profile.status(), 'supplier profile for inbox').toBe(200);
    const supplier = (await profile.json()) as { orgId: string };
    expect(supplier.orgId).toBeTruthy();

    let propertyId = seed.propertyId;
    if (!propertyId) {
      const listed = await request.get(`${API}/properties`, { headers: auth });
      expect(listed.status()).toBe(200);
      const rows = (await listed.json()) as { id: string }[];
      expect(rows.length, 'host property for F1–F2 SR').toBeGreaterThan(0);
      propertyId = rows[0].id;
    }

    const sr = await request.post(`${API}/service-requests`, {
      headers: auth,
      data: {
        propertyId,
        bookingId: seed.bookingId,
        supplierOrgId: supplier.orgId,
        category: 'cleaning',
        notes: `F1-F2 ${Date.now()}`,
      },
    });
    expect(sr.status(), 'F1 seed ServiceRequest Richiesto').toBe(201);
    const created = (await sr.json()) as { id: string; status: string };
    expect(created.status).toBe('Richiesto');

    await page.goto('/app/supplier/inbox');
    await expect(page.getByTestId('supplier-inbox-page')).toBeVisible({ timeout: 20_000 });

    const take = page.getByTestId(`take-${created.id}`);
    await expect(take, 'AC13 F1 Presa in carico must be reachable').toBeVisible({ timeout: 15_000 });
    await take.click();
    await expect(page.getByText(/Presa in carico|Preso in carico|PresoInCarico|Richiesta accettata/i)).toBeVisible({
      timeout: 15_000,
    });

    const complete = page.getByTestId(`complete-${created.id}`);
    await expect(complete, 'AC13 F2 Completa must be reachable').toBeVisible({ timeout: 15_000 });
    await complete.click();
    await expect(page.getByText(/Completato|Lavoro completato/i)).toBeVisible({ timeout: 15_000 });

    const after = await request.get(`${API}/service-requests/${created.id}`, { headers: auth });
    expect(after.status()).toBe(200);
    expect(((await after.json()) as { status: string }).status, 'AC13 host API reflects Completato').toBe(
      'Completato',
    );

    expect(api500, 'AC3 no API 500 on F1–F2').toEqual([]);
  });
});
