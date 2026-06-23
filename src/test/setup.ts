import '@testing-library/jest-dom';
import i18n from '@/i18n/config';

// Ensure i18n is initialized before any test renders.
// i18next.init() is idempotent — calling it again after module-level init is a no-op.
// Resources are statically imported in config.ts so this resolves synchronously.
beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.init();
  }
});
