import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ApiClient } from '@/api/client';
import { DirectPortalActivation } from '../direct-portal-activation';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('direct institutional cutover', () => {
  it('requires both cutover confirmations and the current police delegation before contacting the backend', async () => {
    await i18n.changeLanguage('it');
    const routes = { alloggiatiAvailable: true, istatSupported: true, istatAvailable: true,
      effectiveFrom: { alloggiati: null, istat: null }, delegationVersion: '2026-11-v1' };
    const put = vi.spyOn(ApiClient, 'put').mockResolvedValue(routes);
    render(<I18nextProvider i18n={i18n}><QueryClientProvider client={new QueryClient()}>
      <DirectPortalActivation propertyId="p1" routes={routes} canWrite service="alloggiati" />
    </QueryClientProvider></I18nextProvider>);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('institutionalPortals.chooseDirect') }));
    const submit = screen.getByRole('button', { name: i18n.t('institutionalPortals.activate') });
    const checks = screen.getAllByRole('checkbox');
    expect(checks).toHaveLength(3);
    fireEvent.click(checks[0]);
    fireEvent.click(checks[1]);
    expect(submit).toBeDisabled();
    fireEvent.click(checks[2]);
    fireEvent.click(submit);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/properties/p1/institutional-routes/alloggiati', {
      previousSendersDisabled: true, periodReconciled: true, delegationVersion: '2026-11-v1',
    }));
  });
});
