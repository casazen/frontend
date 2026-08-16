/**
 * Local-only helper: log in via the existing web Auth0 callback and write the
 * access token to %TEMP%/casazen-e2e-access.token. Does not print secrets.
 */
import { chromium } from '@playwright/test';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

function loadEnvFile(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) return;
  for (const line of readFileSync(absolutePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.e2e');

const email = process.env.E2E_AUTH0_EMAIL;
const password = process.env.E2E_AUTH0_PASSWORD;
if (!email || !password) {
  console.error('MISSING_E2E_CREDENTIALS');
  process.exit(1);
}

const outPath = resolve(process.env.TEMP || homedir(), 'casazen-e2e-access.token');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60_000);

await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const loginButton = page.locator('button').filter({ hasText: /sign in|accedi|log in|login|auth0/i }).first();
await loginButton.waitFor({ state: 'visible', timeout: 15_000 });
await loginButton.click();
await page.waitForURL(/auth0\.com/, { timeout: 30_000 });

const usernameField = page
  .locator('input[name="username"], input[name="email"], input[type="email"], input[autocomplete="username"], input[autocomplete="email"]')
  .first();
await usernameField.waitFor({ state: 'visible', timeout: 15_000 });
await usernameField.fill(email);

const passwordField = page.locator('input[name="password"], input[type="password"], input[autocomplete="current-password"]').first();
const passwordVisible = await passwordField.isVisible({ timeout: 3_000 }).catch(() => false);
if (!passwordVisible) {
  await page.locator('button[type="submit"], button[name="action"], button[data-action-button-primary="true"]').first().click();
  await passwordField.waitFor({ state: 'visible', timeout: 15_000 });
}
await passwordField.fill(password);
await page.locator('button[type="submit"], button[name="action"], button[data-action-button-primary="true"]').first().click();
await page.waitForURL((url) => !url.hostname.includes('auth0.com'), { timeout: 60_000 });
await page.waitForTimeout(3000);

const token = await page.evaluate(() => {
  for (const key of Object.keys(localStorage)) {
    if (!key.includes('auth0spajs')) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
      if (parsed.body?.access_token) return parsed.body.access_token;
    } catch {
      /* continue */
    }
  }
  return null;
});

await browser.close();

if (!token) {
  console.error('TOKEN_NOT_FOUND');
  process.exit(2);
}

writeFileSync(outPath, token, { encoding: 'utf8' });
console.log(`TOKEN_OK len=${token.length} path_set=1`);
