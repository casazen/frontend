import type { Page } from '@playwright/test';
import { test, expect } from './test';

const fixture = '/e2e/fixtures/team-invite.html';
const owner = { id: 'owner', userId: 'demo', email: 'owner@example.test', firstName: 'Demo', lastName: 'Owner', role: 'Owner', status: 'Active', propertyScope: 'All', createdAt: '2026-01-01T00:00:00Z', deactivatedAt: null };
const activeTeam = { items: [{ ...owner, areas: ['short-rent'] }] };

async function openFromMenu(page: Page) {
  await page.goto(fixture, { waitUntil: 'domcontentloaded' });
  const people = page.getByRole('navigation', { name: 'Menu Amministrazione' }).getByRole('link', { name: 'Persone', exact: true });
  await people.click();
  await page.getByTestId('people-invite').click();
  await expect(people).toHaveAttribute('aria-current', 'page');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/orgs/me/invitations', route => route.fulfill({ json: [] }));
  await page.route('**/api/orgs/me/roles', route => route.fulfill({ json: { roles: [] } }));
  await page.route('**/api/orgs/me/settings', route => route.fulfill({ json: { defaultLanguage: 'it' } }));
});

test('an agency without active areas can return directly to People', async ({ page }) => {
  await page.route('**/api/orgs/me/members', route => route.fulfill({ json: { items: [{ ...owner, areas: [] }] } }));
  await openFromMenu(page);
  await expect(page.getByText('Per inviare l’invito serve almeno un’area attiva dell’agenzia.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Riprova' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Torna a Persone' }).click();
  await expect(page.getByTestId('people-page')).toBeVisible();
});

test('a temporary error can be retried to open the invitation without leaving it', async ({ page }) => {
  let available = false;
  await page.route('**/api/orgs/me/members', route => available
    ? route.fulfill({ json: activeTeam })
    : route.fulfill({ status: 503, json: { title: 'Unavailable' } }));
  await openFromMenu(page);
  await expect(page.getByText('Non riusciamo a caricare le aree attive dell’agenzia.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Torna a Persone' })).toBeVisible();
  available = true;
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.getByTestId('invite-name')).toBeVisible();
});

test('a private account opening a saved invitation address can return to its team', async ({ page }) => {
  await page.route('**/api/users/me', route => route.fulfill({ json: { id: 'private', org: { id: 'own', isAgency: false } } }));
  await page.route('**/api/orgs/me/members', route => route.fulfill({ json: activeTeam }));
  await page.goto(fixture + '?invite', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Solo gli amministratori di agenzia possono invitare collaboratori.')).toBeVisible();
  await page.getByRole('link', { name: 'Torna a Persone' }).click();
  await expect(page.getByTestId('people-page')).toBeVisible();
  await expect(page.getByTestId('people-invite')).toHaveCount(0);
});

test('an empty role matrix offers an explanation and the operator can leave the wizard', async ({ page }) => {
  await page.route('**/api/orgs/me/members', route => route.fulfill({ json: activeTeam }));
  await openFromMenu(page);
  await page.getByTestId('invite-name').fill('Persona Demo');
  await page.getByTestId('invite-email').fill('test@example.test');
  await page.getByTestId('invite-next').click();
  await expect(page.getByText(/Il tuo account non può assegnare alcun ruolo/)).toBeVisible();
  await expect(page.getByTestId('invite-next')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Riprova' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Torna a Persone' }).click();
  await expect(page.getByTestId('people-page')).toBeVisible();
});

test('the role retry preserves the answers and an unqueued invitation leads to pending invitations', async ({ page }) => {
  const invitation = {
    id: 'invite-1', name: 'Persona Demo', email: 'test@example.test', role: 'Collaborator', areas: ['short-rent'], propertyScope: 'All', propertyIds: [],
    status: 'Pending', invitedByUserId: owner.userId, createdAt: '2026-11-01T12:00:00Z', lastSentAt: null, expiresAt: '2027-11-08T12:00:00Z', reminderSentAt: null,
  };
  let roleAvailable = false;
  let submitted = 0;
  await page.route('**/api/orgs/me/members', route => route.fulfill({ json: activeTeam }));
  await page.route('**/api/orgs/me/roles', route => roleAvailable
    ? route.fulfill({ json: { roles: [{ role: 'Collaborator', assignable: true, scopeSupported: true, permissionsByContext: {}, capabilities: [] }] } })
    : route.fulfill({ status: 503, json: { title: 'Unavailable' } }));
  await page.route('**/api/orgs/me/invitations', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: submitted ? [invitation] : [] });
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject({ name: invitation.name, email: invitation.email, role: invitation.role, areas: invitation.areas });
    submitted++;
    return route.fulfill({ status: 201, json: { invitation, emailQueued: false } });
  });
  await openFromMenu(page);
  await page.getByTestId('invite-name').fill(invitation.name);
  await page.getByTestId('invite-email').fill(invitation.email);
  await page.getByTestId('invite-next').click();
  await expect(page.getByText('Non riusciamo a leggere i ruoli che puoi dare.')).toBeVisible();
  await expect(page.getByTestId('invite-next')).toBeDisabled();
  await expect(page.getByTestId('area-property-picker')).toHaveCount(0);
  roleAvailable = true;
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.getByTestId('invite-role-Collaborator')).toBeChecked();
  await page.getByTestId('invite-next').click();
  await expect(page.getByTestId('area-property-picker')).toBeVisible();
  await page.getByTestId('invite-next').click();
  await expect(page.getByTestId('invite-wizard')).toContainText(invitation.email);
  expect(submitted).toBe(0);
  await page.getByTestId('invite-finish').click();
  await expect(page.getByTestId('invite-done')).toContainText('L’email non è partita');
  await expect(page.getByTestId('invite-copy-link')).toBeVisible();
  await page.getByRole('link', { name: 'Vedi gli inviti' }).click();
  await expect(page.getByTestId('people-page')).toContainText(invitation.name);
  expect(submitted).toBe(1);
});

test('reopening the final step without a server receipt lets the operator check the team', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/orgs/me/members', route => route.fulfill({ json: activeTeam }));
  await page.route('**/api/orgs/me/invitations', route => {
    if (route.request().method() !== 'GET') writes++;
    return route.fulfill({ json: [] });
  });
  await page.goto(fixture + '?invite&done', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Verifica lo stato dell’invito')).toBeVisible();
  await expect(page.getByTestId('invite-done')).toHaveCount(0);
  await page.getByRole('link', { name: 'Vai alle persone' }).click();
  await expect(page.getByTestId('people-page')).toBeVisible();
  expect(writes).toBe(0);
});
