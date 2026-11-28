import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import { touristTaxApi } from '@/api/tourist-tax.api';
import i18n from '@/i18n/config';
import { useConfirmPortalTouristTaxComuni } from '@/queries/use-billing-setup';
import type { ItalianTouristTaxView } from '../billing-wizard-model';
import { TouristTaxStep } from '../steps/tourist-tax-step';

vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/tourist-tax.api', () => ({ touristTaxApi: { getAll: vi.fn() } }));

function appClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnMount: false } } });
}

const milano = { id: 'p1', name: 'Casa 1', city: 'Milano' };
const roma = { id: 'p2', name: 'Casa 2', city: 'Roma' };

function step(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <TouristTaxStep country="IT" />
    </QueryClientProvider>
  );
}

function WithPortals({ view }: { view: ItalianTouristTaxView }) {
  const confirm = useConfirmPortalTouristTaxComuni();
  return <TouristTaxStep country="IT" portals={{ view, confirm, busy: false, onRefused: () => undefined }} />;
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(touristTaxApi.getAll).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('the tourist tax of an Italian issuer lists the comuni of the properties as they are now (E11/F02/US01/T01)', () => {
  // The list of the properties is the one the app keeps for five minutes. A property created on another page after the list was read must show its comune here, so that the
  // «Da fare» is not missing it: the step reads the list again every time it opens.
  it('ItalianTouristTax_APropertyAddedSinceTheListWasLastRead_ShowsItsComuneWhenTheStepOpensAgain', async () => {
    vi.mocked(propertiesApi.getAll).mockResolvedValueOnce([milano] as never).mockResolvedValueOnce([milano, roma] as never);
    const client = appClient();

    const first = render(step(client));
    expect(await screen.findByText('Milano')).toBeInTheDocument();
    expect(screen.queryByText('Roma')).not.toBeInTheDocument();
    first.unmount();

    render(step(client));
    expect(await screen.findByText('Roma')).toBeInTheDocument();
    expect(screen.getByText('Milano')).toBeInTheDocument();
    expect(propertiesApi.getAll).toHaveBeenCalledTimes(2);
  });
});

describe('the tourist tax of an Italian issuer is the reading of the municipal rules it was when the server says nothing of the portals (FIX/FE-IT-TOURISTTAX-PROPOSALS)', () => {
  it('ItalianTouristTax_NoPortalsOrAViewWithNothingToSay_IsExactlyTheReadingOfTheMunicipalRulesAsItWas', async () => {
    vi.mocked(propertiesApi.getAll).mockResolvedValue([milano, roma] as never);
    const plain = render(step(appClient()));
    expect(await screen.findByText('Roma')).toBeInTheDocument();
    const before = plain.container.innerHTML;
    expect(before).toContain(i18n.t('billingWizard.touristTax.italy.intro'));
    expect(before).not.toContain('billing-portal-tax');
    plain.unmount();

    const nothingToSay = render(
      <QueryClientProvider client={appClient()}>
        <WithPortals view={{ proposals: [], confirmed: [], conflict: false }} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Roma')).toBeInTheDocument();
    expect(nothingToSay.container.innerHTML).toBe(before);
    expect(screen.queryByTestId('billing-portal-tax')).toBeNull();
    nothingToSay.unmount();

    const unreadable = render(
      <QueryClientProvider client={appClient()}>
        <WithPortals view={{ proposals: [], confirmed: null, conflict: false }} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Roma')).toBeInTheDocument();
    expect(unreadable.container.innerHTML).toBe(before);
  });

  it('ItalianTouristTax_APortalsBlockIsThereWhileTheRatesAreStillOnTheirWay_AndWhenTheyCannotBeRead', async () => {
    vi.mocked(propertiesApi.getAll).mockResolvedValue([milano] as never);
    vi.mocked(touristTaxApi.getAll).mockRejectedValue(new Error('rates'));
    const view: ItalianTouristTaxView = {
      proposals: [{ comuneIstat: '015146', comune: 'Milano', channel: 'Airbnb', status: 'to_confirm' }],
      confirmed: [],
      conflict: false,
    };

    render(
      <QueryClientProvider client={appClient()}>
        <WithPortals view={view} />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('billing-tourist-tax-italy-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('billing-portal-proposal')).toHaveAttribute('data-comune', '015146');
    expect(screen.getByTestId('billing-portal-confirm-Airbnb-015146')).toBeEnabled();
  });
});
