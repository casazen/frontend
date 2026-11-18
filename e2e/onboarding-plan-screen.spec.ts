import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';
import { connectionTaskPath, mockOnboardingPlanScreen, onboardingPlanPath } from './helpers/onboarding-plan-screen';
import { demoUrl } from './helpers/demo-profile';
import { expectNoAxeViolations, expectNothingSticksOut } from './helpers/ui-checks';

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900], [1440, 1200]]) {
  test(`piano di avvio senza preferenza · prima vista a ${width} × ${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await mockOnboardingPlanScreen(page);
    await page.goto(demoUrl(onboardingPlanPath, 'short-stay'), { waitUntil: 'domcontentloaded' });
    const planPage = page.getByTestId('onboarding-plan-page');
    await expect(planPage.getByRole('heading', { level: 1 })).toBeVisible();
    const sender = page.getByTestId('org-sender-preference');
    await expect(sender.getByRole('radio')).toHaveCount(2);
    await expect(sender.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.getByTestId('onboarding-needs')).toBeAttached();
    await expect(page.getByTestId('onboarding-part-octorateConnection-open')).toBeAttached();
    await expectNothingSticksOut(page, 'Piano di avvio');
    await page.evaluate(() => document.fonts.ready);
    const shot = info.outputPath(`piano-avvio-${width}x${height}.jpg`);
    await page.screenshot({ path: shot, type: 'jpeg', quality: 79, animations: 'disabled' });
    await info.attach('piano-avvio', { path: shot, contentType: 'image/jpeg' });

    const metrics = await planPage.evaluate(root => {
      const actions = Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="onboarding-part-"][data-testid$="-open"], [data-testid^="onboarding-part-"][data-testid$="-later"]'));
      const visible = actions.filter(el => el.checkVisibility() && !el.closest('details:not([open])'));
      const review = root.querySelector<HTMLElement>('[data-testid="org-sender-preference"] button:not([aria-expanded])');
      const bottomBar = document.querySelector<HTMLElement>('nav[aria-label="Navigazione mobile"]');
      const actionBottom = review?.getBoundingClientRect().bottom;
      const contentEnd = bottomBar?.checkVisibility() ? bottomBar.getBoundingClientRect().top : innerHeight;
      return {
        taskActions: visible.length,
        inViewport: visible.filter(el => el.getBoundingClientRect().bottom <= innerHeight && el.getBoundingClientRect().top >= 0).length,
        reviewActionAboveNavigation: actionBottom == null ? null : actionBottom <= contentEnd,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const data = { width, height, ...metrics, violations: violations.map(v => ({ rule: v.id, targets: v.nodes.map(node => node.target) })) };
    const artifact = info.outputPath(`piano-avvio-${width}x${height}.json`);
    await writeFile(artifact, JSON.stringify(data));
    await info.attach('misure', { path: artifact, contentType: 'application/json' });
    console.info('Piano di avvio', JSON.stringify(data));
    expect(violations.map(v => v.id)).toEqual([]);
  });
}

test('scelta manuale · confermare, uscire, riprendere dalla Home e aprire il collegamento Octorate', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { saved, exits, installOnFreshTab } = await mockOnboardingPlanScreen(page);
  await page.goto(demoUrl(onboardingPlanPath, 'short-stay'), { waitUntil: 'domcontentloaded' });
  const preference = page.getByTestId('org-sender-preference');
  const manual = preference.getByRole('radio', { name: 'Invio manuale', exact: true });
  const review = preference.getByRole('button', { name: 'Rivedi la scelta' });
  await expect(review).toBeDisabled();
  await preference.getByRole('radio', { name: 'Octorate', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(manual).toBeFocused();
  await expect(manual).toBeChecked();
  await review.press('Enter');
  await expect(preference.getByRole('heading', { name: 'Verifica il metodo di invio' })).toBeFocused();
  await expect(page.getByTestId('org-sender-save')).toBeDisabled();
  expect(saved).toHaveLength(0);
  await preference.locator('#org-sender-confirm').press('Space');
  await page.getByTestId('org-sender-save').press('Enter');
  const next = page.getByTestId('onboarding-plan-current').getByTestId('onboarding-part-octorateConnection-open');
  await expect(preference).toContainText('Invio manuale');
  await expect(next).toHaveAttribute('href', connectionTaskPath);
  expect(saved).toEqual([{ sender: 'Manual', expectedLastChangedAt: null, confirmed: true, delegationConsent: false }]);
  await expectNoAxeViolations(page, { include: '[data-testid="onboarding-plan-page"]' });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const shot = info.outputPath('piano-avvio-salvato-390x844.jpg');
  await page.screenshot({ path: shot, type: 'jpeg', quality: 79, animations: 'disabled' });
  await info.attach('mittente-salvato', { path: shot, contentType: 'image/jpeg' });

  const destination = onboardingPlanPath + '#passo-octorateConnection';
  await page.getByTestId('onboarding-plan-exit').press('Enter');
  await expect(page.getByTestId('home-resume-onboarding')).toHaveAttribute('href', destination);
  expect(exits).toEqual(['POST']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('home-resume-onboarding')).toHaveAttribute('href', destination);
  const fresh = await page.context().newPage();
  await fresh.setViewportSize({ width: 390, height: 844 });
  await installOnFreshTab(fresh);
  await page.close();
  await fresh.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
  const resume = fresh.getByTestId('home-resume-onboarding');
  await expect(resume).toHaveAttribute('href', destination);
  await resume.press('Enter');
  await expect(fresh.getByTestId('org-sender-preference')).toContainText('Invio manuale');
  await expect(fresh).toHaveURL(new RegExp('#passo-octorateConnection$'));
  await fresh.getByTestId('onboarding-plan-current').getByTestId('onboarding-part-octorateConnection-open').press('Enter');
  await expect(fresh).toHaveURL(new RegExp(connectionTaskPath + '$'));
  await fresh.getByTestId('part-launch-primary').press('Enter');
  await expect(fresh).toHaveURL(url => url.pathname.endsWith('/integrations/octorate') && url.searchParams.get('step') === 'consent');
  await expect(fresh.getByTestId('octorate-consent-step')).toHaveAttribute('data-phase', 'ready');
  await fresh.getByTestId('octorate-connect-save-exit').press('Enter');
  await expect(fresh).toHaveURL(new RegExp('#passo-octorateConnection$'));
  await expect(fresh.getByTestId('org-sender-preference')).toContainText('Invio manuale');
  expect(saved).toHaveLength(1);
});
