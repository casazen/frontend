import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { OwnerUnitsCheck } from '@/types';
import { OwnerTaxChecksSection } from '../components/owner-tax-checks-section';

const api = vi.hoisted(() => ({ getUnitsCheck: vi.fn(), declareExternalUnits: vi.fn() }));
const OWNER = '11111111-1111-4111-8111-111111111111';

vi.mock('@/api/owner-tax-checks.api', () => ({ ownerTaxChecksApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

/**
 * The limit of apartments of a private owner (E18/F01/US03/T01, NF-117, ⚖ I8): the apartments the owner lets short outside the agency count with the ones the agency manages, past the limit the owner is presumed a
 * business and its stays lose the withholding of the short lets. The number is declared by a person and is never a 0 by omission: an empty field is refused, not saved as «none».
 */

const check = (overrides: Partial<OwnerUnitsCheck> = {}): OwnerUnitsCheck => ({ ownerId: OWNER, applies: true, managedUnits: 2, externalUnits: 0, totalUnits: 2, maxUnits: 2, presumedBusiness: false, ...overrides });

function renderSection(canManage = true, taxReportingExports = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(
      FeatureFlagsContext.Provider,
      { value: { flags: { ...DEFAULT_FEATURE_FLAGS, taxReportingExports }, isLoading: false } },
      createElement(QueryClientProvider, { client }, createElement(OwnerTaxChecksSection, { ownerId: OWNER, canManage })),
    ),
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  api.getUnitsCheck.mockResolvedValue(check());
});

afterEach(() => cleanup());

describe('the apartments an owner lets outside the agency', () => {
  it('OwnerUnits_WithTheFlagOff_NothingIsDrawnAndNothingIsAsked', () => {
    const { container } = renderSection(true, false);
    expect(container.textContent).toBe('');
    expect(api.getUnitsCheck).not.toHaveBeenCalled();
  });

  it('OwnerUnits_WithinTheLimit_SaysSo_AndPastItTheOwnerIsPresumedABusiness', async () => {
    renderSection();
    expect(await screen.findByTestId('owner-units-status')).toHaveAttribute('data-presumed', 'false');
    expect(screen.getByTestId('owner-units-count')).toHaveTextContent("2 gestiti dall'agenzia, 0 dichiarati fuori");
    cleanup();

    api.getUnitsCheck.mockResolvedValue(check({ externalUnits: 1, totalUnits: 3, presumedBusiness: true }));
    renderSection();
    const status = await screen.findByTestId('owner-units-status');
    expect(status).toHaveAttribute('data-presumed', 'true');
    expect(status).toHaveTextContent('presunto un imprenditore');
  });

  it('OwnerUnits_ANumberIsRequired_AnEmptyFieldOrAWrongOneIsRefusedAndNeverSavedAsNone', async () => {
    renderSection();
    const input = await screen.findByTestId('owner-units-input');
    expect(input).toHaveValue('0');

    for (const wrong of ['', '  ', 'abc', '-1', '1001', '1,5']) {
      fireEvent.change(input, { target: { value: wrong } });
      fireEvent.click(screen.getByTestId('owner-units-save'));
      expect(await screen.findByText(i18n.t('ownerProfile.units.errors.units', { max: 1000 }))).toBeInTheDocument();
    }
    expect(api.declareExternalUnits).not.toHaveBeenCalled();
  });

  it('OwnerUnits_ANumberTheOwnerDeclares_IsSaved_AndTheAnswerOfTheServerIsWhatTheScreenSays', async () => {
    api.declareExternalUnits.mockResolvedValue(check({ externalUnits: 1, totalUnits: 3, presumedBusiness: true }));
    renderSection();
    const input = await screen.findByTestId('owner-units-input');

    fireEvent.change(input, { target: { value: ' 1 ' } });
    fireEvent.click(screen.getByTestId('owner-units-save'));

    await waitFor(() => expect(api.declareExternalUnits).toHaveBeenCalledWith(OWNER, 1));
    // The screen does not work the limit out: it shows the check the server answered.
    await waitFor(() => expect(screen.getByTestId('owner-units-status')).toHaveAttribute('data-presumed', 'true'));
    expect(screen.getByTestId('owner-units-input')).toHaveValue('1');
  });

  it('OwnerUnits_ZeroIsAnAnswerThePersonWrites_NotAnEmptyField', async () => {
    api.getUnitsCheck.mockResolvedValue(check({ externalUnits: 2, totalUnits: 4, presumedBusiness: true }));
    api.declareExternalUnits.mockResolvedValue(check());
    renderSection();
    const input = await screen.findByTestId('owner-units-input');

    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('owner-units-save'));

    await waitFor(() => expect(api.declareExternalUnits).toHaveBeenCalledWith(OWNER, 0));
  });

  it('OwnerUnits_WhoMayNotManageTheFinances_ReadsTheNumbersAndCannotChangeThem', async () => {
    renderSection(false);

    expect(await screen.findByTestId('owner-units-count')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-units-form')).toBeNull();
  });

  it('OwnerUnits_ABusinessAlreadyHasNothingToDeclare_AndARefusedReadIsToldAsSuch', async () => {
    api.getUnitsCheck.mockResolvedValue(check({ applies: false }));
    renderSection();
    expect(await screen.findByTestId('owner-units-not-applicable')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-units-form')).toBeNull();
    cleanup();

    api.getUnitsCheck.mockResolvedValue(null);
    renderSection();
    expect(await screen.findByTestId('owner-units-not-for-you')).toBeInTheDocument();
    // A read that is refused is not «within the limit».
    expect(screen.queryByTestId('owner-units-status')).toBeNull();
  });
});
