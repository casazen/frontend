import type { Page } from '@playwright/test';

/** Pin locale before app boot — L2 specs assert the product default (`it`). */
export async function pinE2eLocale(page: Page, locale: 'en' | 'it' = 'it'): Promise<void> {
  await page.addInitScript((lng) => {
    localStorage.setItem('casazen.locale', lng);
  }, locale);
}

export async function resetE2eStorage(page: Page, locale: 'en' | 'it' = 'it'): Promise<void> {
  await page.addInitScript((lng) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('casazen.locale', lng);
  }, locale);
}
