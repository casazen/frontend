import { test, expect } from '@playwright/test';
import { provisionLegacyCommercialSignup } from './gj-l3/commercial-signup';

test('legacy signup waits for automatic redirects to show billing without a competing goto', async ({ page }) => {
  const navigations: string[] = [];
  let saved = 0;
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) navigations.push(new URL(frame.url()).pathname + new URL(frame.url()).search);
  });
  await page.route('https://signup.example.test/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/users/onboarding') {
      expect(request.method()).toBe('POST');
      expect(request.postDataJSON()).toEqual({ rentalType: 'LongTerm', consents: true });
      saved += 1;
      await route.fulfill({ json: { rolesSynced: false, orgProvisioned: true, orgId: 'org-test' } });
    } else if (url.pathname === '/app/long-rent/properties/new') {
      await route.fulfill({ contentType: 'text/html', body: '<script>location.replace("/onboarding?payment=required")</script>' });
    } else if (url.pathname === '/onboarding' && url.searchParams.get('payment') === 'required') {
      await route.fulfill({ contentType: 'text/html', body: '<label>Billing country<select id="signup-billing-country"><option>IT</option></select></label>' });
    } else {
      await route.fulfill({ contentType: 'text/html', body: `
        <h1>Da dove vuoi iniziare?</h1>
        <button onclick="document.querySelector('section').hidden=false">Scegli</button>
        <button onclick="document.querySelector('section').hidden=false">Scegli</button>
        <section hidden data-testid="onboarding-consents-step">
          <label><input type="checkbox" onchange="document.querySelector('#continue').disabled=!this.checked">Terms and privacy</label>
          <button disabled id="continue" data-testid="onboarding-consents-continue" onclick="save()">Continue</button>
        </section>
        <script>async function save() {
          const response = await fetch('/api/users/onboarding', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({rentalType:'LongTerm', consents:document.querySelector('input').checked})});
          if (response.ok) location.assign('/app/long-rent/properties/new?first=1');
        }</script>
      ` });
    }
  });
  await page.goto('https://signup.example.test/onboarding');
  await provisionLegacyCommercialSignup(page, 'long-rent');
  await expect(page.locator('#signup-billing-country')).toBeVisible();
  await expect(page).toHaveURL('https://signup.example.test/onboarding?payment=required');
  expect(saved).toBe(1);
  expect(navigations).toEqual(['/onboarding', '/app/long-rent/properties/new?first=1', '/onboarding?payment=required']);
});
