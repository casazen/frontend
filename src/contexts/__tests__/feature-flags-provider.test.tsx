import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureFlagsProvider } from '../feature-flags-provider';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { parseFeatureFlags } from '@/config/feature-flags';
import { featuresApi } from '@/api/features.api';

vi.mock('@/api/features.api', () => ({
  featuresApi: { getFeatures: vi.fn() },
}));

function Probe() {
  const { flags, isLoading } = useFeatureFlags();
  return <p>{isLoading ? 'loading' : `ota=${flags.otaPartnerApi}`}</p>;
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>
    </QueryClientProvider>,
  );
}

describe('FeatureFlagsProvider', () => {
  beforeEach(() => {
    vi.mocked(featuresApi.getFeatures).mockReset();
  });

  it('exposes the flags returned by GET /api/public/features', async () => {
    vi.mocked(featuresApi.getFeatures).mockResolvedValue({ otaPartnerApi: true });

    renderProvider();

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('ota=true')).toBeInTheDocument();
  });

  it('keeps every flag off when the flags cannot be read', async () => {
    vi.mocked(featuresApi.getFeatures).mockRejectedValue(new Error('network'));

    renderProvider();

    await waitFor(() => expect(screen.getByText('ota=false')).toBeInTheDocument());
  });

  it('is off without a provider', () => {
    render(<Probe />);

    expect(screen.getByText('ota=false')).toBeInTheDocument();
  });
});

describe('parseFeatureFlags', () => {
  it('turns on only the known flags set to true', () => {
    const allOff = { otaPartnerApi: false, aiSupplierDiscovery: false };
    expect(parseFeatureFlags({ otaPartnerApi: true, somethingElse: true })).toEqual({ ...allOff, otaPartnerApi: true });
    expect(parseFeatureFlags({ aiSupplierDiscovery: true })).toEqual({ ...allOff, aiSupplierDiscovery: true });
    expect(parseFeatureFlags({ otaPartnerApi: 'true', aiSupplierDiscovery: 1 })).toEqual(allOff);
    expect(parseFeatureFlags(null)).toEqual(allOff);
    expect(parseFeatureFlags({})).toEqual(allOff);
  });
});
