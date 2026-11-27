import { act, renderHook, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { leasesApi } from '@/api/leases.api';
import { useRegistrationFlow } from '../../hooks/use-registration-flow';
import { buildDetail, httpError } from '../../__tests__/lease-test-utils';
import type { RliChecklist } from '@/types';

vi.mock('@/queries/use-leases', () => ({ useTriggerRegistration: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/api/leases.api', () => ({ leasesApi: { createRegistrationCheckout: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const wrapper = ({ children }: PropsWithChildren) => <MemoryRouter>{children}</MemoryRouter>;
const checklist = { providerFilingAvailable: true } as RliChecklist;
const setup = () => renderHook(() => useRegistrationFlow(buildDetail({ status: 'Signed' }), checklist), { wrapper });

describe('registration payment ordering', () => {
  it('opens data collection before any checkout or delegation', () => {
    const { result } = setup();
    act(() => result.current.startCheckout());
    expect(result.current.preparationProps.open).toBe(true);
    expect(result.current.dialogProps.open).toBe(false);
    expect(leasesApi.createRegistrationCheckout).not.toHaveBeenCalled();
  });
  it('continues a server-confirmed paid filing without opening a second checkout', async () => {
    const { result } = setup();
    await act(() => result.current.preparationProps.onPrepared(true));
    expect(result.current.dialogProps.open).toBe(true);
    expect(leasesApi.createRegistrationCheckout).not.toHaveBeenCalled();
  });
  it('recovers a payment completed while the form was open', async () => {
    vi.mocked(leasesApi.createRegistrationCheckout).mockRejectedValueOnce(httpError(409, { code: 'openapi_registration_already_paid' }));
    const { result } = setup();
    await act(() => result.current.preparationProps.onPrepared(false));
    expect(leasesApi.createRegistrationCheckout).toHaveBeenCalledTimes(1);
    expect(result.current.dialogProps.open).toBe(true);
  });
});
