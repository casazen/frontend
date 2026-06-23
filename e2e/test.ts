import { test as base, expect } from '@playwright/test';
import { installDemoUserMeMock, mockPlansCatalog } from './helpers/org-api-mock';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('casazen.locale')) {
        localStorage.setItem('casazen.locale', 'en');
      }
    });
    await installDemoUserMeMock(page);
    await mockPlansCatalog(page);
    await use(page);
  },
});

export { expect };
