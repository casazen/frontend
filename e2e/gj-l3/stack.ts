import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** What `e2e/stack/up.sh` wrote about the running ephemeral stack (FN-03). */
export type StackEnv = {
  apiUrl: string;
  feUrl: string;
  mailUrl: string;
  dbName: string;
  runId: string;
  password: string;
  /** True when Stripe test keys were given to the backend (CI secrets). */
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

/** Logs in through the mock IdP's login form, the same redirect flow Auth0 Universal Login uses. */
export async function loginAs(page: Page, stack: StackEnv, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: /accedi|sign in|log in|login/i }).first().click();
  await page.waitForURL(/\/authorize/, { timeout: 30_000 });
  await page.locator('input#username').fill(email);
  await page.locator('input#password').fill(stack.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.origin === new URL(stack.feUrl).origin, { timeout: 30_000 });
}

/** Bearer token of the session in the browser, used only by the API oracle (asserts), never to drive the journey. */
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

/** Read-only API oracle on behalf of one signed-in actor: the assertion side, not the action side. */
export function oracleFor(request: APIRequestContext, stack: StackEnv, token: string): Oracle {
  return {
    async get<T>(path: string): Promise<T> {
      const res = await request.get(`${stack.apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status(), `GET ${path}`).toBe(200);
      return (await res.json()) as T;
    },
  };
}

export type Mail = { to: string[]; subject: string; html: string };

export async function mailbox(request: APIRequestContext, stack: StackEnv): Promise<Mail[]> {
  const res = await request.get(`${stack.mailUrl}/__outbox`);
  return (await res.json()) as Mail[];
}

/** Waits for a message to `to` whose subject matches, and returns it. */
export async function waitForMail(
  request: APIRequestContext,
  stack: StackEnv,
  to: string,
  subject: RegExp,
): Promise<Mail> {
  let found: Mail | undefined;
  await expect
    .poll(
      async () => {
        found = (await mailbox(request, stack)).find(
          (m) => m.to.some((a) => a.toLowerCase() === to.toLowerCase()) && subject.test(m.subject),
        );
        return Boolean(found);
      },
      { message: `email to ${to} matching ${subject}`, timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  return found as Mail;
}

/** First absolute link of the email that points at the app (`/path-prefix`). */
export function linkIn(mail: Mail, pathPrefix: string): string {
  const matches = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const link = matches.find((href) => new URL(href).pathname.startsWith(pathPrefix));
  expect(link, `link ${pathPrefix} in "${mail.subject}"`).toBeTruthy();
  return link as string;
}
