/* eslint-disable react-refresh/only-export-components -- A helper of the tests: it has a component of its own (the probe of the address) next to the functions the tests call. */
import { render, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { PROPERTIES_PATH, PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import type { OctorateConnection } from '@/types';
import { OctorateConnectWizardPage } from '../connect-wizard';
import { OCTORATE_CONNECT_PATH } from '../octorate-callback';

/** The user and the organization the draft of the wizard belongs to (the tests mock `useCurrentUser` with the same ones). */
export const SCOPE = { userId: 'user-1', orgId: 'org-1' };

/** The name the wizard keeps its draft under. */
export const WIZARD_DRAFT_ID = 'octorate-connect';

export const WAIT = { timeout: 5000 };

/** The address of the consent page of the channel manager, as the API gives it (https). */
export const CONSENT_URL = 'https://consent.example.test/oauth?client_id=client&state=state-of-the-consent';

/** What `GET api/octorate/connection` answers. */
export function connection(overrides: Partial<OctorateConnection> = {}): OctorateConnection {
  return {
    status: 'Disconnected',
    environment: 'Test',
    accountId: null,
    lastSyncedAt: null,
    quotaLimit: null,
    quotaRemaining: null,
    quotaWarning: false,
    ...overrides,
  };
}

/** The error of a request the server refused, as axios builds it (the code is what the app translates). */
export function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

/** The wizard on its own route, with the pages it can lead to marked. */
export function renderWizard(url: string = OCTORATE_CONNECT_PATH) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <LocationProbe />
          <Routes>
            <Route path={OCTORATE_CONNECT_PATH} element={<OctorateConnectWizardPage />} />
            <Route path={PROPERTY_CREATE_PATH} element={<div data-testid="listing-wizard" />} />
            <Route path={PROPERTIES_PATH} element={<div data-testid="properties-list" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

/** The address the router is at now, path and query. */
export const currentLocation = () => screen.getByTestId('location').textContent;

export async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', step), WAIT);
}
