import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { ListingChannelStatus } from '@/types';
import { PropertyWizardPage } from '../property-wizard-page';

const { flags, listingStatus } = vi.hoisted(() => ({
  flags: { octorateConnector: true },
  listingStatus: { data: undefined as unknown, isError: false, isLoading: false },
}));

vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: () => null }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags, isLoading: false }) }));
vi.mock('@/queries/use-properties', () => ({
  useProperty: () => ({ data: { id: 'p1', name: 'Casa', rentalMode: 'Short', address: 'Via Roma 1', city: 'Como', maxGuests: 2 }, isError: false }),
}));
vi.mock('@/features/compliance/use-compliance', () => ({
  useComplianceActivation: () => ({ data: { complianceStatus: 'Pending', steps: [] }, isError: false }),
}));
vi.mock('@/queries/use-listing-status', () => ({ useListingStatus: () => listingStatus }));
vi.mock('../use-wizard-listing-seed', () => ({
  useWizardListingSeed: () => ({ seed: { rooms: [], stayDiscounts: [], siteProfile: null, photoMeta: [] }, failed: false, error: null, retry: vi.fn() }),
}));
// The wizard itself is not under test here: only what the page hands it.
vi.mock('../property-wizard', () => ({
  PropertyWizard: (props: { onlySteps?: string[]; initialStepId?: string }) => (
    <pre data-testid="wizard-props">{JSON.stringify({ onlySteps: props.onlySteps ?? null, initialStepId: props.initialStepId ?? null })}</pre>
  ),
}));

const row = (channel: string, missing: string[] = []): ListingChannelStatus => ({
  channel,
  status: 'Published',
  completeness: 100,
  missing,
  lastSyncedAt: null,
  syncLagSeconds: null,
  syncAlert: false,
  errorCode: null,
  reason: null,
  reasonDetail: null,
  changedOutside: [],
});

const onChannels = (...rows: ListingChannelStatus[]) => {
  listingStatus.data = { propertyId: 'p1', channels: rows, cinNotSentTo: [] };
  listingStatus.isError = false;
};

const open = (search = '?propertyId=p1') =>
  render(
    <MemoryRouter initialEntries={[`/app/short-rent/properties/create${search}`]}>
      <PropertyWizardPage />
    </MemoryRouter>,
  );

const handedOver = () => JSON.parse(screen.getByTestId('wizard-props').textContent ?? '{}') as { onlySteps: string[] | null; initialStepId: string | null };

describe('PropertyWizardPage: a listing that is already on the channels (NF-29)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    flags.octorateConnector = true;
    onChannels(row('booking_xml', ['descriptions', 'prices']));
  });

  it('opensOnTheStepsThatLackData_ThenTheChannelsAndTheEnd_WithASwitchForTheRest', () => {
    open();

    expect(handedOver()).toEqual({ onlySteps: ['descriptions', 'prices', 'channels', 'finish'], initialStepId: 'descriptions' });
    expect(screen.getByTestId('property-wizard-imported')).toHaveTextContent('ti mostriamo solo i passi in cui manca qualcosa');

    fireEvent.click(screen.getByTestId('property-wizard-show-all'));

    // «Mostra tutti i passi»: the whole wizard, as it opens for a property that is not on the channels.
    expect(handedOver().onlySteps).toBeNull();
    expect(screen.getByTestId('property-wizard-imported')).toHaveTextContent('Stai vedendo tutti i passi');
  });

  it('theStepNamedInTheAddress_IsKept_TheListStaysTheSame', () => {
    open('?propertyId=p1&step=rules');

    expect(handedOver()).toEqual({ onlySteps: ['descriptions', 'prices', 'channels', 'finish'], initialStepId: null });
  });

  it('noChannelYet_TheWizardOpensWhole_WithNoNotice', () => {
    onChannels();
    open();

    expect(handedOver().onlySteps).toBeNull();
    expect(screen.queryByTestId('property-wizard-imported')).not.toBeInTheDocument();
  });

  it('theStatusCannotBeRead_TheWizardOpensWholeAsItAlwaysDid', () => {
    listingStatus.data = undefined;
    listingStatus.isError = true;
    open();

    expect(handedOver().onlySteps).toBeNull();
    expect(screen.queryByTestId('property-wizard-imported')).not.toBeInTheDocument();
  });

  it('connectorOff_TheWizardOpensWhole_NoMatterWhatTheStatusWouldSay', () => {
    flags.octorateConnector = false;
    open();

    expect(handedOver().onlySteps).toBeNull();
    expect(screen.queryByTestId('property-wizard-imported')).not.toBeInTheDocument();
  });
});
