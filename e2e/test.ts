import { test as base, expect } from '@playwright/test';
import { installDemoUserMeMock } from './helpers/org-api-mock';

export const test = base.extend({
  page: async ({ page }, use) => {
    await installDemoUserMeMock(page);
    await use(page);
  },
});

export { expect };
