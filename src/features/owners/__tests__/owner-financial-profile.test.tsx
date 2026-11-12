import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { OWNER_ID, policy, profile } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import { maskValue, OWNER_ONBOARDING_PATH } from '@/features/owner-accounting/owner-accounting-model';
import { OwnerFinancialProfilePage } from '../owner-financial-profile-page';

const api = vi.hoisted(() => ({
  listOwners: vi.fn(),
  getOnboardingReadiness: vi.fn(),
  listFiscalProfiles: vi.fn(),
  listPolicies: vi.fn(),
  approvePolicy: vi.fn(),
  saveFiscalProfile: vi.fn(),
  createPolicy: vi.fn(),
}));

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_admin' }] }) }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, primary }: { title: string; primary?: { label: string; onClick?: () => void; testId?: string } }) =>
    createElement('div', null, createElement('h1', null, title), primary ? createElement('button', { type: 'button', onClick: primary.onClick, 'data-testid': primary.testId }, primary.label) : null),
}));

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, { initialEntries: [`/app/account/owners/${OWNER_ID}/financial`] }, createElement(Routes, null, createElement(Route, { path: '/app/account/owners/:ownerId/financial', element: createElement(OwnerFinancialProfilePage) }))),
    ),
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  api.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
  api.getOnboardingReadiness.mockResolvedValue(null);
  api.listFiscalProfiles.mockResolvedValue([profile()]);
  api.listPolicies.mockResolvedValue([policy()]);
});

afterEach(() => cleanup());

describe('the financial profile of an owner (E06/F05/US02/T01, T04)', () => {
  it('OwnerProfile_UnauthorizedRole_SeesOnlyMaskedData_AndCanNeitherRevealNorEdit', async () => {
    renderPage();
    const facts = await screen.findByTestId('profile-facts');

    // The identifiers, the address and the account are exactly what the server answered: masked. There is no control that asks for more.
    expect(facts.querySelector('dl')).toHaveAttribute('data-masked', 'true');
    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent('••••••••••••3456');
    expect(within(facts).getByTestId('profile-value-bankAccountReference')).toHaveTextContent('•••••••••••••••••••••3456');
    expect(within(facts).getByTestId('profile-value-legalName')).toHaveTextContent('•••••••••ossi');
    expect(screen.queryByTestId('profile-reveal')).toBeNull();
    expect(screen.getByTestId('profile-masked-notice')).toHaveTextContent(text('ownerProfile.maskedNotice'));
    // Who sees masked values may not change the profile either: no way to save a new version.
    expect(screen.queryByTestId('profile-new-version')).toBeNull();
    expect(screen.queryByTestId('policy-new')).toBeNull();
    // The page never asks for more: nothing here reads the full IBAN of the registry or writes anything.
    expect(Object.keys(api)).not.toContain('getOwnerIban');
    for (const write of [api.saveFiscalProfile, api.approvePolicy, api.createPolicy]) expect(write).not.toHaveBeenCalled();
  });

  it('OwnerProfile_AuthorizedRole_SeesTheValuesMaskedUntilTheyAskForThem', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: 'IT60X0542811101000000123456', legalName: 'Marta Rossi' })]);
    renderPage();
    const facts = await screen.findByTestId('profile-facts');

    // Received in full, shown masked: a screen left open does not show the IBAN of the owner.
    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent(maskValue('RSSMRT80A01H501U') as string);
    expect(within(facts).getByTestId('profile-value-fiscalCode')).not.toHaveTextContent('RSSMRT80A01H501U');
    expect(within(facts).getByTestId('profile-value-bankAccountReference')).not.toHaveTextContent('IT60X0542811101000000123456');

    const reveal = within(facts).getByTestId('profile-reveal');
    expect(reveal).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(reveal);
    expect(within(facts).getByTestId('profile-value-bankAccountReference')).toHaveTextContent('IT60X0542811101000000123456');
    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent('RSSMRT80A01H501U');

    fireEvent.click(within(facts).getByTestId('profile-reveal'));
    expect(within(facts).getByTestId('profile-value-bankAccountReference')).not.toHaveTextContent('IT60X0542811101000000123456');
    expect(screen.getByTestId('profile-new-version')).toBeInTheDocument();
  });

  it('OwnerProfile_ARuleNotApprovedYet_BlocksTheOwner_AndTheAccountantApprovalIsRecordedByName', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    api.listPolicies.mockResolvedValue([policy({ approved: false, approvedAt: null, approvedByName: null })]);
    api.approvePolicy.mockResolvedValue(policy());
    renderPage();

    const focus = await screen.findByTestId('profile-focus');
    expect(focus).toHaveAttribute('data-tone', 'warning');
    expect(focus).toHaveTextContent(text('ownerProfile.focus.blocked.policy_not_approved.title'));
    expect(screen.getByTestId('policy-approval')).toHaveTextContent(text('ownerProfile.policy.waiting'));

    fireEvent.click(screen.getByTestId('profile-focus-approve'));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: text('ownerProfile.approveDialog.confirm') });
    // CasaZen does not approve a rule: it records who did. Without a name nothing is sent.
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('policy-approver'), { target: { value: 'Dott. Bianchi' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(api.approvePolicy).toHaveBeenCalledWith('b1000000-0000-4000-8000-000000000001', 'Dott. Bianchi'));
  });

  it('OwnerProfile_AProfileWithAnApprovedRule_IsReady_AndSaysWhoApprovedIt', async () => {
    renderPage();
    const focus = await screen.findByTestId('profile-focus');

    expect(focus).toHaveAttribute('data-tone', 'success');
    expect(focus).toHaveTextContent('Dott. Bianchi');
    expect(screen.getByTestId('profile-policy-section')).toHaveTextContent(text('ownerProfile.policy.approved'));
  });

  it('OwnerProfile_MissingFactsOfTheActivation_LinkBackToIt', async () => {
    api.getOnboardingReadiness.mockResolvedValue({
      asOf: '2026-11-12',
      summary: { financialReady: false },
      owners: [
        {
          ownerId: OWNER_ID,
          displayName: 'Marta Rossi',
          accountingReady: false,
          reasons: [
            { dimension: 'mandate', code: 'mandate_missing', field: null, propertyId: 'p-1' },
            { dimension: 'ownership', code: 'shares_gap', field: null, propertyId: 'p-1' },
            { dimension: 'payment', code: 'something_new', field: null, propertyId: null },
          ],
        },
      ],
      properties: [
        {
          propertyId: 'p-1',
          name: 'Casa Mare',
          ownershipReady: false,
          reasons: [],
          issues: [
            { kind: 'gap', from: '2025-01-01', to: '2025-03-31', totalPercent: 0, ownerId: null },
            { kind: 'shortfall', from: '2025-04-01', to: null, totalPercent: 60, ownerId: null },
          ],
        },
      ],
    });
    renderPage();

    const section = await screen.findByTestId('profile-onboarding');
    await within(section).findByTestId('profile-onboarding-reasons');
    expect(within(section).getByText(text('ownerProfile.reason.mandateMissing'))).toBeInTheDocument();
    expect(section).toHaveTextContent('Casa Mare');
    // A reason of a later version is told by its code, never dropped.
    expect(section).toHaveTextContent(text('ownerProfile.reason.other', { code: 'something_new' }));
    expect(within(section).getByTestId('profile-onboarding-link')).toHaveAttribute('href', OWNER_ONBOARDING_PATH);

    // The periods where the shares of the property are wrong, with what they add up to.
    const issues = within(section).getByTestId('profile-ownership-issues');
    const lines = within(issues).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute('data-kind', 'gap');
    expect(lines[0]).toHaveTextContent('Casa Mare');
    expect(lines[0]).toHaveTextContent('2025');
    expect(lines[1]).toHaveTextContent('60%');
    expect(lines[1]).toHaveTextContent(text('ownerProfile.ownership.onward'));
  });

  it('OwnerProfile_WithoutTheActivationModule_SaysSoInsteadOfShowingNothing', async () => {
    renderPage();
    const section = await screen.findByTestId('profile-onboarding');

    expect(section).toHaveTextContent(text('ownerProfile.onboarding.unavailable'));
    expect(within(section).queryByTestId('profile-onboarding-link')).toBeNull();
  });
});
