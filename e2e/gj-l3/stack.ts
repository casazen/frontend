import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type StackEnv = {
  apiUrl: string;
  feUrl: string;
  mailUrl: string;
  dbName: string;
  runId: string;
  password: string;
  stripe: boolean;
};

export function loadStack(): StackEnv {
  const path = resolve(process.cwd(), 'e2e/.stack/env.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as StackEnv;
  } catch {
    throw new Error(`Ephemeral stack not running: start it with e2e/stack/up.sh (missing ${path}).`);
  }
}

export async function loginAs(page: Page, stack: StackEnv, email: string): Promise<void> {
  await page.goto('/login');
  await page.waitForURL(/\/authorize/, { timeout: 30_000 });
  await page.locator('input#username').fill(email);
  await page.locator('input#password').fill(stack.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.origin === new URL(stack.feUrl).origin, { timeout: 30_000 });
}

export async function accessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      const raw = localStorage.getItem(key);
      if (!raw?.includes('access_token')) continue;
      const parsed = JSON.parse(raw) as { body?: { access_token?: string } };
      if (parsed.body?.access_token) return parsed.body.access_token;
    }
    return null;
  });
  expect(token, 'access token of the signed-in session').toBeTruthy();
  return token as string;
}

export type Oracle = {
  get: <T>(path: string) => Promise<T>;
};

export function oracleFor(request: APIRequestContext, stack: StackEnv, token: string): Oracle {
  return {
    async get<T>(path: string): Promise<T> {
      const res = await request.get(`${stack.apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status(), `GET ${path}`).toBe(200);
      return (await res.json()) as T;
    },
  };
}

export type Mail = { at: string; to: string[]; subject: string; html: string };

export async function mailbox(request: APIRequestContext, stack: StackEnv): Promise<Mail[]> {
  const res = await request.get(`${stack.mailUrl}/__outbox`);
  return (await res.json()) as Mail[];
}

export async function waitForMail(
  request: APIRequestContext,
  stack: StackEnv,
  to: string,
  subject: RegExp,
  since = '',
): Promise<Mail> {
  let found: Mail | undefined;
  await expect
    .poll(
      async () => {
        found = (await mailbox(request, stack)).findLast(
          (m) => m.to.some((a) => a.toLowerCase() === to.toLowerCase()) && subject.test(m.subject) && m.at >= since,
        );
        return Boolean(found);
      },
      { message: `email to ${to} matching ${subject}`, timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  return found as Mail;
}

export function linkIn(mail: Mail, pathPrefix: string): string {
  const matches = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const link = matches.find((href) => new URL(href).pathname.startsWith(pathPrefix));
  expect(link, `link ${pathPrefix} in "${mail.subject}"`).toBeTruthy();
  return link as string;
}

export function romeDay(offsetDays = 0): string {
  const when = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(when);
}

export function sql(stack: StackEnv, statement: string): string {
  return execFileSync('psql', ['-X', '-A', '-t', '-d', stack.dbName, '-c', statement], {
    encoding: 'utf8',
    env: process.env,
  }).trim();
}

export function linkConnectedAccount(stack: StackEnv, orgSlug: string, accountId: string): void {
  const slug = orgSlug.replace(/'/g, "''");
  const acct = accountId.replace(/'/g, "''");
  const updated = sql(
    stack,
    `UPDATE "Orgs" SET "StripeConnectedAccountId" = '${acct}', "ConnectChargesEnabled" = true, ` +
      `"ConnectDetailsSubmitted" = true, "ConnectPayoutsEnabled" = true WHERE "Slug" = '${slug}' RETURNING 1`,
  );
  expect(updated, `organization ${orgSlug} linked to a connected account`).toContain('1');
}

export async function createStripeTestConnectedAccount(secretKey: string): Promise<string> {
  if (!/^(sk|rk)_test_/.test(secretKey)) throw new Error('Refusing to use a non test-mode Stripe key in the E2E.');
  const form = new URLSearchParams({
    type: 'custom',
    country: 'IT',
    email: 'gj-host@example.test',
    'business_type': 'individual',
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
    'business_profile[mcc]': '7011',
    'business_profile[url]': 'https://accessible.stripe.com',
    'individual[first_name]': 'Giulia',
    'individual[last_name]': 'Rossi',
    'individual[dob][day]': '1',
    'individual[dob][month]': '1',
    'individual[dob][year]': '1990',
    'individual[address][line1]': 'address_full_match',
    'individual[address][city]': 'Roma',
    'individual[address][postal_code]': '00153',
    'individual[address][country]': 'IT',
    'individual[id_number]': 'RSSGLI90A41H501N',
    'individual[email]': 'gj-host@example.test',
    'individual[phone]': '+390612345678',
    'external_account[object]': 'bank_account',
    'external_account[country]': 'IT',
    'external_account[currency]': 'eur',
    'external_account[account_number]': 'IT60X0542811101000000123456',
    'tos_acceptance[date]': String(Math.floor(Date.now() / 1000)),
    'tos_acceptance[ip]': '127.0.0.1',
  });
  const res = await fetch('https://api.stripe.com/v1/accounts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const body = (await res.json()) as { id?: string; error?: { message: string } };
  if (!res.ok || !body.id) throw new Error(`Stripe test account creation failed: ${body.error?.message ?? res.status}`);
  return body.id;
}
