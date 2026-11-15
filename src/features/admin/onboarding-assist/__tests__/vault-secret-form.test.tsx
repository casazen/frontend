import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingAssistApi } from '@/api/onboarding-assist.api';
import { problemError } from '@/features/onboarding/__tests__/onboarding-fixtures';
import { VaultSecretForm } from '../vault-secret-form';

vi.mock('@/api/onboarding-assist.api', () => ({ onboardingAssistApi: { storeVaultSecret: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ORG = 'aa11bb22-cc33-4d44-8e55-ff6677889900';
const PROPERTY = '77777777-0000-4000-8000-000000000001';
const USERNAME = 'octorate-aa11bb22@mail.casazen.test';
const PASSWORD = 'Pa55-Word-S3cret!';

let client: QueryClient;

function renderForm(propertyId: string | null = PROPERTY, present = false) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <VaultSecretForm orgId={ORG} propertyId={propertyId} present={present} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function fill(testId: string, value: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  vi.mocked(onboardingAssistApi.storeVaultSecret).mockReset().mockResolvedValue({
    id: 's1',
    orgId: ORG,
    propertyId: PROPERTY,
    kind: 'OctoratePanel',
    createdAt: '2026-11-15T10:00:00Z',
    updatedAt: '2026-11-15T10:00:00Z',
    updatedByUserId: 'auth0|staff',
  });
  vi.mocked(toast.success).mockReset();
});

afterEach(cleanup);

describe('VaultSecretForm, the user of the panel of a structure for the support vault (E20/F03/US02/T01)', () => {
  it('VaultSecretForm_Closed_ShowsOnlyTheButtonThatOpensItAndAskedNothing', () => {
    renderForm();

    expect(screen.getByTestId('assist-vault-open')).toHaveTextContent(i18n.t('onboardingPlan.assist.vault.open'));
    expect(screen.queryByTestId('assist-vault-form')).not.toBeInTheDocument();
  });

  it('VaultSecretForm_ACredentialThatIsThere_OffersToReplaceItNeverToReadIt', () => {
    renderForm(PROPERTY, true);

    expect(screen.getByTestId('assist-vault-open')).toHaveTextContent(i18n.t('onboardingPlan.assist.vault.replace'));
    fireEvent.click(screen.getByTestId('assist-vault-open'));
    // Write-only: the fields are empty, the password is a password field and nothing says what is stored.
    expect(screen.getByTestId('assist-vault-username')).toHaveValue('');
    expect(screen.getByTestId('assist-vault-password')).toHaveValue('');
    expect(screen.getByTestId('assist-vault-password')).toHaveAttribute('type', 'password');
    expect(screen.getByTestId('assist-vault-password')).toHaveAttribute('autocomplete', 'off');
  });

  it('VaultSecretForm_MissingValues_SaysSoAndSendsNothing', () => {
    renderForm();
    fireEvent.click(screen.getByTestId('assist-vault-open'));

    fill('assist-vault-username', '   ');
    fireEvent.click(screen.getByTestId('assist-vault-save'));

    expect(screen.getByText(i18n.t('onboardingPlan.assist.vault.errors.usernameRequired'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('onboardingPlan.assist.vault.errors.passwordRequired'))).toBeInTheDocument();
    expect(onboardingAssistApi.storeVaultSecret).not.toHaveBeenCalled();
  });

  it('VaultSecretForm_ValidValues_SendsThemForTheOrgAndThePropertyThenEmptiesAndClosesTheForm', async () => {
    renderForm();
    fireEvent.click(screen.getByTestId('assist-vault-open'));

    fill('assist-vault-username', USERNAME);
    fill('assist-vault-password', PASSWORD);
    fireEvent.click(screen.getByTestId('assist-vault-save'));

    await waitFor(() =>
      expect(onboardingAssistApi.storeVaultSecret).toHaveBeenCalledWith({ orgId: ORG, propertyId: PROPERTY, kind: 'OctoratePanel', username: USERNAME, password: PASSWORD }),
    );
    // The values leave the page as soon as the server has them, and are in no cache of the queries or of the mutations.
    await waitFor(() => expect(screen.queryByTestId('assist-vault-form')).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain(PASSWORD);
    expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.assist.vault.saved'));
    await waitFor(() => expect(JSON.stringify(client.getMutationCache().getAll().map((mutation) => mutation.state))).not.toContain(PASSWORD));
    expect(JSON.stringify(client.getQueryCache().getAll().map((query) => query.state))).not.toContain(PASSWORD);
    // Open again: the fields are empty.
    fireEvent.click(screen.getByTestId('assist-vault-open'));
    expect(screen.getByTestId('assist-vault-password')).toHaveValue('');
  });

  it('VaultSecretForm_TheCredentialOfTheWholeOrganization_LeavesThePropertyOut', async () => {
    renderForm(null);
    fireEvent.click(screen.getByTestId('assist-vault-open'));

    fill('assist-vault-username', USERNAME);
    fill('assist-vault-password', PASSWORD);
    fireEvent.click(screen.getByTestId('assist-vault-save'));

    await waitFor(() => expect(onboardingAssistApi.storeVaultSecret).toHaveBeenCalledWith({ orgId: ORG, kind: 'OctoratePanel', username: USERNAME, password: PASSWORD }));
  });

  it('VaultSecretForm_TheServerRefuses_KeepsTheValuesToBeCorrectedAndSaysWhy', async () => {
    vi.mocked(onboardingAssistApi.storeVaultSecret).mockRejectedValue(problemError(422, { code: 'support_vault_value_invalid' }));
    renderForm();
    fireEvent.click(screen.getByTestId('assist-vault-open'));

    fill('assist-vault-username', USERNAME);
    fill('assist-vault-password', PASSWORD);
    fireEvent.click(screen.getByTestId('assist-vault-save'));

    expect(await screen.findByTestId('assist-vault-error')).toHaveTextContent(i18n.t('apiErrors.codes.supportVaultValueInvalid'));
    expect(screen.getByTestId('assist-vault-username')).toHaveValue(USERNAME);
    expect(screen.getByTestId('assist-vault-save')).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
