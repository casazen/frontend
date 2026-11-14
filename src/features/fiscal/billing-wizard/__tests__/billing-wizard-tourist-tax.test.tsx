import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import { touristTaxApi } from '@/api/tourist-tax.api';
import i18n from '@/i18n/config';
import { TouristTaxStep } from '../steps/tourist-tax-step';

vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/tourist-tax.api', () => ({ touristTaxApi: { getAll: vi.fn() } }));

/** The client of the app (`query-client.ts`): a list that was read stays fresh for five minutes and is never read again when a page mounts. */
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
