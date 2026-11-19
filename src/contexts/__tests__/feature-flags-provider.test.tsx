import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureFlagsProvider } from '../feature-flags-provider';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { DEFAULT_FEATURE_FLAGS, parseFeatureFlags } from '@/config/feature-flags';
import { featuresApi } from '@/api/features.api';

vi.mock('@/api/features.api', () => ({
  featuresApi: { getFeatures: vi.fn() },
}));

function Probe() {
  const { flags, isLoading } = useFeatureFlags();
  return <p>{isLoading ? 'loading' : `ota=${flags.otaPartnerApi}`}</p>;
}

/** Says whether the flags are known, which is what tells «off» from «could not be read». */
function ErrorProbe() {
  const { isLoading, isError } = useFeatureFlags();
  return <p>{isLoading ? 'loading' : `unreadable=${isError === true}`}</p>;
}

function renderProvider(probe = <Probe />) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider>{probe}</FeatureFlagsProvider>
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

  it('says that the flags are not known when the first read fails, so a screen can tell «off» from «unreadable»', async () => {
    vi.mocked(featuresApi.getFeatures).mockRejectedValue(new Error('network'));

    renderProvider(<ErrorProbe />);

    expect(await screen.findByText('unreadable=true')).toBeInTheDocument();
  });

  it('does not say it when the flags were read', async () => {
    vi.mocked(featuresApi.getFeatures).mockResolvedValue({ otaPartnerApi: false });

    renderProvider(<ErrorProbe />);

    expect(await screen.findByText('unreadable=false')).toBeInTheDocument();
  });

  it('is off without a provider', () => {
    render(<Probe />);

    expect(screen.getByText('ota=false')).toBeInTheDocument();
  });
});

describe('parseFeatureFlags', () => {
  it('turns on only the known flags set to true', () => {
    // Every known flag, off: derived from the defaults so that adding a flag does not touch this test.
    const allOff = Object.fromEntries(Object.keys(DEFAULT_FEATURE_FLAGS).map((key) => [key, false])) as typeof DEFAULT_FEATURE_FLAGS;
    // Every flag ships off (fail closed): a default of `true` would turn a feature on for everybody before the backend says so.
    expect(DEFAULT_FEATURE_FLAGS).toEqual(allOff);
    expect(parseFeatureFlags({ otaPartnerApi: true, somethingElse: true })).toEqual({ ...allOff, otaPartnerApi: true });
    expect(parseFeatureFlags({ eSignProvider: true })).toEqual({ ...allOff, eSignProvider: true });
    expect(parseFeatureFlags({ aiSupplierDiscovery: true })).toEqual({ ...allOff, aiSupplierDiscovery: true });
    // The key the backend sends for `Features:AgencyTier` (GET /api/public/features).
    expect(parseFeatureFlags({ agencyTier: true })).toEqual({ ...allOff, agencyTier: true });
    expect(parseFeatureFlags({ otaPartnerApi: 'true', aiSupplierDiscovery: 1 })).toEqual(allOff);
    expect(parseFeatureFlags(null)).toEqual(allOff);
    expect(parseFeatureFlags({})).toEqual(allOff);
  });
});
