import type { Page } from '@playwright/test';

export type DemoProfile = 'short-stay' | 'long-term' | 'dual' | 'admin' | 'triple' | 'onboarding' | 'supplier';

export function demoUrl(path: string, profile: DemoProfile): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}demoProfile=${profile}`;
}

export async function setDemoProfile(page: Page, profile: DemoProfile): Promise<void> {
  await page.addInitScript((value) => {
    (window as Window & { __E2E_DEMO_PROFILE?: string }).__E2E_DEMO_PROFILE = value;
    sessionStorage.setItem('casazen:demo-profile', value);
  }, profile);
}
