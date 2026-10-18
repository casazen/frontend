import { beforeEach, describe, expect, it, vi } from 'vitest';
import { propertyModeApi } from '../property-mode.api';
import { ApiClient } from '../client';
import { PROPERTY_ID, change, preview, state } from '@/features/properties/mode/__tests__/mode-fixtures';

vi.mock('../client');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('propertyModeApi (PM-02 endpoints)', () => {
  it('getState_ReadsTheModeOfTheProperty', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(state());

    const result = await propertyModeApi.getState(PROPERTY_ID);

    expect(ApiClient.get).toHaveBeenCalledWith(`/properties/${PROPERTY_ID}/mode`);
    expect(result).toEqual(state());
  });

  it.each([
    ['Long' as const, 'long'],
    ['Short' as const, 'short'],
  ])('preview_To%s_AsksForTheLowercaseNameOfTheMode', async (to, wire) => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(preview());

    await propertyModeApi.preview(PROPERTY_ID, to, '2026-12-01');

    expect(ApiClient.get).toHaveBeenCalledWith(`/properties/${PROPERTY_ID}/mode/preview`, { to: wire, date: '2026-12-01' });
  });

  it('preview_WithoutADay_AsksForTheFirstDayPossible', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue(preview());

    await propertyModeApi.preview(PROPERTY_ID, 'Long');
    await propertyModeApi.preview(PROPERTY_ID, 'Long', '');

    // No `date` at all (not an empty one): the server answers for the first day it can.
    for (const [, params] of vi.mocked(ApiClient.get).mock.calls) {
      expect(params).toEqual({ to: 'long', date: undefined });
    }
  });

  it('schedule_PostsTheModeAndTheDay', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(change());

    const result = await propertyModeApi.schedule(PROPERTY_ID, { to: 'Long', effectiveDate: '2026-12-01' });

    expect(ApiClient.post).toHaveBeenCalledWith(`/properties/${PROPERTY_ID}/mode/change`, { to: 'Long', effectiveDate: '2026-12-01' });
    expect(result).toEqual(change());
  });

  it('cancel_DeletesTheChangeById', async () => {
    vi.mocked(ApiClient.delete).mockResolvedValueOnce(undefined);

    await propertyModeApi.cancel(PROPERTY_ID, 'c1');

    expect(ApiClient.delete).toHaveBeenCalledWith(`/properties/${PROPERTY_ID}/mode/change/c1`);
  });
});
