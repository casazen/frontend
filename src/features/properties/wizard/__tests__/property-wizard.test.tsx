import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { PropertyWizard } from '../property-wizard';

const { flags, createMock, toast } = vi.hoisted(() => ({
  flags: { octorateConnector: false },
  createMock: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags, isLoading: false }) }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, org: { id: 'o1' } }),
  useEntitlement: () => ({ data: undefined }),
}));
vi.mock('@/queries/use-properties', () => ({
  usePlanUsage: () => ({ data: { used: 0, max: null, unlimited: true, canAdd: true } }),
  useCancellationPolicies: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock('../use-wizard-property', () => ({
  useWizardCreateProperty: () => ({ mutateAsync: createMock }),
  useWizardSaveProperty: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/queries/use-listing-data', () => ({
  useSavePropertyRooms: () => ({ mutateAsync: vi.fn() }),
  useSaveStayDiscounts: () => ({ mutateAsync: vi.fn() }),
  usePropertyRooms: () => ({ data: undefined }),
}));
vi.mock('@/queries/use-site-profile', () => ({
  useSaveListingTexts: () => ({ mutateAsync: vi.fn() }),
  useSavePhotoMeta: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/features/compliance/use-compliance', () => ({
  useComplianceActivation: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
  useCompleteComplianceActivation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => ({ data: { datasetAvailable: false }, isPending: false, isError: false, refetch: vi.fn() }),
  useComuneSearch: () => ({ data: undefined, isFetching: false, isError: false, isSuccess: false, refetch: vi.fn() }),
  useComune: () => ({ data: undefined, isError: false }),
}));

function open() {
  return render(
    <MemoryRouter initialEntries={['/app/short-rent/properties/create']}>
      <Routes>
        <Route path="/app/short-rent/properties/create" element={<PropertyWizard />} />
        <Route path="/app/short-rent/properties" element={<p>Elenco immobili</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PropertyWizard (E02/F03/US01)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    window.localStorage.clear();
    createMock.mockReset();
    toast.success.mockReset();
    flags.octorateConnector = false;
  });

  it('firstStep_SaveAndExitIsThereToo_NothingIsSavedSoItOnlyExits', () => {
    open();

    expect(screen.getByTestId('property-wizard')).toHaveAttribute('data-step', 'base');
    fireEvent.click(screen.getByTestId('property-wizard-save-close'));

    expect(screen.getByText('Elenco immobili')).toBeInTheDocument();
    // Nothing is created by leaving, and the host is not told that something was saved.
    expect(createMock).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Le risposte del primo passo restano qui'));
  });

  it('steps_TheChannelsStepIsThereOnlyWhereTheChannelManagerIsConnected', () => {
    const { unmount } = open();
    // Not connected (the production default): the wizard has the steps it always had, plus the texts.
    for (const label of ['Dati base', 'Foto', 'Dotazioni', 'Testi', 'Regole', 'Prezzi', 'Attivazione']) {
      expect(screen.getAllByText(label).length, label).toBeGreaterThan(0);
    }
    expect(screen.queryAllByText('Canali')).toHaveLength(0);
    unmount();

    flags.octorateConnector = true;
    open();
    expect(screen.getAllByText('Canali').length).toBeGreaterThan(0);
  });
});
