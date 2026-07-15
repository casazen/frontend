import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';

const DEMO_ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

test.describe('Custom domain settings (#298)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/orgs/${DEMO_ORG_ID}/domain`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: DEMO_ORG_ID,
            publicHostMode: 'CasazenSubdomain',
            subdomain: 'villa-demo',
            customDomain: null,
            domainVerificationStatus: 'Pending',
            canUseCustomDomain: true,
            dnsInstructions: null,
            publicUrls: {
              pathUrl: 'https://casazen.app/book/villa-demo',
              subdomainUrl: 'https://villa-demo.casazen.it',
              customDomainUrl: null,
            },
          }),
        });
        return;
      }

      if (route.request().method() === 'POST' && !route.request().url().includes('/verify')) {
        const body = route.request().postDataJSON() as { hostMode: string; customDomain?: string };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: DEMO_ORG_ID,
            publicHostMode: body.hostMode,
            subdomain: null,
            customDomain: body.customDomain ?? null,
            domainVerificationStatus: body.hostMode === 'CustomDomain' ? 'Pending' : 'Pending',
            canUseCustomDomain: true,
            dnsInstructions: body.hostMode === 'CustomDomain'
              ? {
                  cnameHost: body.customDomain,
                  cnameTarget: 'cname.vercel-dns.com',
                  txtHost: `_casazen-challenge.${body.customDomain}`,
                  txtValue: 'demo-token',
                  sslNote: 'SSL automatico via Vercel',
                }
              : null,
            publicUrls: {
              pathUrl: 'https://casazen.app/book/villa-demo',
              subdomainUrl: null,
              customDomainUrl: body.customDomain ? `https://${body.customDomain}` : null,
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.route('**/api/orgs/me/entitlement', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orgId: DEMO_ORG_ID,
          planTier: 'Pro',
          limits: { maxProperties: 50 },
          usage: { properties: 1 },
          canAddProperty: true,
          canUseCustomDomain: true,
        }),
      });
    });
  });

  test('AC9: domain settings page loads current config', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/settings/domain'));
    await expect(page.getByTestId('custom-domain-settings-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('domain-current-config')).toBeVisible();
    await expect(page.getByText('villa-demo.casazen.it')).toBeVisible();
  });

  test('AC9: saving custom domain shows DNS instructions', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/settings/domain'));
    await expect(page.getByTestId('custom-domain-settings-page')).toBeVisible({ timeout: 15_000 });

    await page.locator('[data-testid="host-mode-radio"]').selectOption('CustomDomain');
    await page.getByTestId('custom-domain-input').fill('www.demo-villa.it');
    await page.getByTestId('save-domain-settings').click();

    await expect(page.getByTestId('dns-instructions-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('copy-txt-value')).toBeVisible();
  });
});
