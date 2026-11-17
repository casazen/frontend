import { beforeEach, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { priceSuggestionApi } from '../price-suggestion.api';

vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

it('allows the bounded provider call to return instead of timing out at the default thirty seconds', async () => {
  vi.mocked(axios.post).mockResolvedValue({ data: { aiUsed: false, reason: 'ai_unavailable' } });
  await expect(priceSuggestionApi.suggest('p1', 'Market')).resolves.toEqual({ aiUsed: false, reason: 'ai_unavailable' });
  expect(axios.post).toHaveBeenCalledWith('/properties/p1/price-suggestion', { positioning: 'Market' }, { timeout: 120_000 });
});
