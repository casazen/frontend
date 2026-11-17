import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../src/i18n/config';
import '../../src/styles/globals.css';
import { AuthAppProviders } from '../../src/contexts/auth-bridge';
import { WorkspaceContext } from '../../src/contexts/workspace-context';
import { FeatureFlagsContext } from '../../src/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '../../src/config/feature-flags';
import { PersonPreviewPage } from '../../src/features/team/person-preview-page';
import axios from '../../src/lib/axios';

// Test-only entry loads the real page, hooks and permission model with synthetic local API responses.
const context = {
  contexts: [{ contextKey: 'account', roleKey: 'org_owner', permissions: ['org.members.manage'] }],
  activeContext: 'account', isReady: true, setActiveContext: () => {},
  hasPermission: () => true, getDefaultRoute: () => '/app/account',
};
const roles = [
  { role: 'Owner', assignable: false, scopeSupported: false, permissionsByContext: { account: { roleKey: 'owner', permissions: ['org.members.manage'] } }, capabilities: [] },
  { role: 'Collaborator', assignable: true, scopeSupported: true, permissionsByContext: { 'short-rent': { roleKey: 'collaborator', permissions: ['booking.read', 'property.read'] } }, capabilities: [{ id: 'booking', group: 'short-rent', level: 'Read' }, { id: 'prices', group: 'short-rent', level: 'No' }] },
  { role: 'Admin', assignable: true, scopeSupported: false, permissionsByContext: { account: { roleKey: 'admin', permissions: ['org.members.manage', 'org.settings.manage', 'org.billing.manage'] }, 'short-rent': { roleKey: 'admin', permissions: ['booking.read', 'property.read'] } }, capabilities: [{ id: 'booking', group: 'short-rent', level: 'Yes' }, { id: 'prices', group: 'short-rent', level: 'Yes' }, { id: 'people', group: 'account', level: 'Yes' }, { id: 'billing', group: 'account', level: 'Yes' }] },
];
const member = { id: 'anna', userId: 'anna', email: 'anna@example.com', firstName: 'Anna', lastName: 'Rossi', role: 'Collaborator', areas: ['short-rent'], propertyScope: 'Selected', status: 'Active', createdAt: '2026-11-01T12:00:00Z', deactivatedAt: null };
axios.defaults.adapter = async (config) => {
  const url = config.url ?? '';
  if (config.method !== 'get') throw new Error('The access preview must not write data');
  let data = [];
  if (url.endsWith('/members')) data = { items: [member, { ...member, id: 'owner', userId: 'demo', email: 'demo@casazen.com', firstName: 'Demo', lastName: 'Owner', role: 'Owner', propertyScope: 'All' }] };
  else if (url.endsWith('/roles')) data = { roles };
  else if (url.endsWith('/properties')) data = { memberId: 'anna', properties: [{ propertyId: 'one', name: 'Casa Lago', granted: true }, { propertyId: 'two', name: 'Casa Sole', granted: true }, { propertyId: 'three', name: 'Riservata', granted: false }] };
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
createRoot(document.getElementById('root')).render(
  <AuthAppProviders>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WorkspaceContext.Provider value={context}>
        <FeatureFlagsContext.Provider value={{ flags: DEFAULT_FEATURE_FLAGS, isLoading: false }}>
          <MemoryRouter initialEntries={['/app/account/people/m-anna/preview']}>
            <main className="mx-auto max-w-7xl p-5 pb-28">
              <Routes><Route path="/app/account/people/:key/preview" element={<PersonPreviewPage />} /></Routes>
            </main>
          </MemoryRouter>
        </FeatureFlagsContext.Provider>
      </WorkspaceContext.Provider>
    </QueryClientProvider>
  </AuthAppProviders>,
);
