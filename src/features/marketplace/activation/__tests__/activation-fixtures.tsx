/* eslint-disable react-refresh/only-export-components -- A helper of the tests: it has a component of its own (the probe of the address) next to the functions the tests call. */
import { render, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import type { MarketplaceActivationMapping, MarketplaceActivationPlan, MarketplaceActivationState, MarketplaceChannelRoom, Property } from '@/types';
import { CHANNELS_PAGE_PATH, MARKETPLACE_PATH } from '../../lib/marketplace-paths';
import { ActivationWizardPage } from '../activation-wizard-page';
import { activationWizardId } from '../activation-wizard-model';

export const SCOPE = { userId: 'user-1', orgId: 'org-1' };

export const WAIT = { timeout: 5000 };

export const CHANNEL_CODE = '142';
export const CHANNEL_NAME = 'Booking.com';
export const ACTIVATION_PATH = `/app/short-rent/marketplace/activate/channel/${CHANNEL_CODE}`;

export const WIZARD_DRAFT_ID = activationWizardId('Channel', CHANNEL_CODE);

export function property(id = 'prop-1', name = 'Casa Rosa'): Property {
  return { id, name, address: 'Via Roma 12', city: 'Milano', maxGuests: 4 } as Property;
}

export function plan(overrides: Partial<MarketplaceActivationPlan> = {}): MarketplaceActivationPlan {
  return {
    kind: 'Channel',
    code: CHANNEL_CODE,
    name: CHANNEL_NAME,
    propertyId: 'prop-1',
    requirements: ['hotelId', 'credentials'],
    creatable: true,
    propertyLinked: true,
    activationId: null,
    activationStatus: null,
    ...overrides,
  };
}

export function state(overrides: Partial<MarketplaceActivationState> = {}): MarketplaceActivationState {
  return {
    activationId: 'act-1',
    kind: 'Channel',
    code: CHANNEL_CODE,
    propertyId: 'prop-1',
    status: 'Pending',
    connectionFound: true,
    connectionStatus: 'WAITING',
    panelAccessDone: true,
    lastSyncedAt: null,
    lastErrorCode: null,
    connectionLastUpdate: null,
    ...overrides,
  };
}

export function channelRoom(overrides: Partial<MarketplaceChannelRoom> = {}): MarketplaceChannelRoom {
  return { channelRoomId: 'room-1', name: 'Camera doppia', rateName: null, manageable: true, mappedProductId: null, proposedProductId: 'prod-1', ...overrides };
}

export function mapping(rooms: MarketplaceChannelRoom[] = [channelRoom()], activationId = 'act-1'): MarketplaceActivationMapping {
  return {
    activationId,
    propertyProductId: null,
    channelRooms: rooms,
    products: [
      { productId: 'prod-1', name: 'Doppia' },
      { productId: 'prod-2', name: 'Suite' },
    ],
  };
}

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

export function renderActivation(url: string = ACTIVATION_PATH) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const rendered = render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <LocationProbe />
          <Routes>
            <Route path="/app/short-rent/marketplace/activate/:kind/:code" element={<ActivationWizardPage />} />
            <Route path={MARKETPLACE_PATH} element={<div data-testid="marketplace-marker" />} />
            <Route path={CHANNELS_PAGE_PATH} element={<div data-testid="channels-marker" />} />
            <Route path="/app/short-rent/somewhere-else" element={<div data-testid="somewhere-else-marker" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );

  return { ...rendered, client };
}

export const currentLocation = () => screen.getByTestId('location').textContent ?? '';

export async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('activation-wizard')).toHaveAttribute('data-step', step), WAIT);
}

export const primaryButton = () => screen.queryByTestId('activation-next') ?? screen.getByTestId('activation-finish');
