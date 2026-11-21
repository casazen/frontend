import type { Page } from '@playwright/test';
import type { OrgComplianceSender, OrgComplianceSenderRequest } from '../../src/api/org-compliance-sender.api';
import { plan } from '../../src/features/onboarding/__tests__/onboarding-fixtures';
import { installDemoUserMeMock, mockPlansCatalog } from './org-api-mock';
import { installDefaultDemoApiMocks } from '../test';

export const onboardingPlanPath = '/app/short-rent/onboarding';
export const connectionTaskPath = onboardingPlanPath + '/parts/octorateConnection';

export async function mockOnboardingPlanScreen(page: Page) {
  const activation = plan({
    octorateConnection: { state: 'open', reason: 'connection_missing', done: 0, total: 1 },
    properties: { state: 'blocked', reason: 'required_part_not_done', done: 0, total: 1 },
  });
  let preference: OrgComplianceSender = {
    sender: null, delegationAccepted: false, delegationTextVersion: '2026-11-v1',
    propertyOverrides: 0, autoSendGuestsToOctorate: false, lastChangedAt: null,
  };
  const saved: OrgComplianceSenderRequest[] = [];
  const exits: string[] = [];

  async function install(target: Page) {
    await target.route('**/api/public/features', route => route.fulfill({ json: { octorateOnboarding: true, octorateConnector: true } }));
    await target.route('**/api/onboarding/plan', route => route.fulfill({ json: activation }));
    await target.route('**/api/onboarding/path', route => route.fulfill({ json: activation.path }));
    // The part page loads the properties of the flow (NF-106). Without a page shape, PartPropertyTable used to crash on `.items.length`.
    await target.route('**/api/onboarding/flows/*/properties**', route =>
      route.fulfill({ json: { items: [], totalCount: 0, page: 1, pageSize: 20 } }),
    );
    await target.route('**/api/wizards/OnboardingActivation/draft**', route => route.fulfill({ status: 404, json: {} }));
    await target.route('**/api/octorate/connection', route => route.fulfill({ json: { status: 'Disconnected' } }));
    await target.route('**/api/orgs/me/compliance-sender', async route => {
      if (route.request().method() === 'PUT') {
        const body: OrgComplianceSenderRequest = route.request().postDataJSON();
        saved.push(body);
        preference = {
          ...preference, sender: body.sender, delegationAccepted: body.delegationConsent,
          autoSendGuestsToOctorate: body.autoSendGuestsToOctorate ?? false, lastChangedAt: '2026-11-18T12:00:00Z',
        };
      } else if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({ json: preference });
    });
    await target.route('**/api/onboarding/parts/octorateConnection/exit', async route => {
      exits.push(route.request().method());
      await route.fulfill({ json: { code: 'octorateConnection', state: 'open', todoId: '00000000-0000-4000-8000-000000000080', remindAt: null } });
    });
  }
  await install(page);

  async function installOnFreshTab(target: Page) {
    await installDemoUserMeMock(target);
    await mockPlansCatalog(target);
    await installDefaultDemoApiMocks(target);
    await target.route('**/api/onboarding/status**', route => route.fulfill({ json: {
      roleChosen: true, orgProvisioned: true, consentsAccepted: true, propertyCreated: true,
      sitePublished: false, firstBookingTaken: false, activated: false, steps: [], flows: [],
    } }));
    await install(target);
  }
  return { saved, exits, installOnFreshTab };
}
