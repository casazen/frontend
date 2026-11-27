import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, Routes, Route} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import '../../src/i18n/config';
import '../../src/styles/globals.css';
import {WorkspaceContext} from '../../src/contexts/workspace-context';
import {FeatureFlagsContext} from '../../src/contexts/feature-flags-context';
import {DEFAULT_FEATURE_FLAGS} from '../../src/config/feature-flags';
import {OwnerFinancialProfilePage} from '../../src/features/owners/owner-financial-profile-page';
import {profile, policy, OWNER_ID} from '../../src/features/owner-accounting/__tests__/owner-accounting-fixtures';
import axios, { setApiAuthHandlers } from '../../src/lib/axios';
setApiAuthHandlers({ getAccessToken: async () => 'owner-profile-fixture-token' });

const fiscal = profile({ masked: false, legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A41F205X', legalAddress: 'Via Roma 12, Como', bankAccountReference: 'IT60X0542811101000000123456' });
const address = { street: 'Via Roma', buildingNumber: '12', postalCode: '22100', town: 'Como', province: 'CO', country: 'IT' };
const issuer = {
  ownerId: OWNER_ID, exists: true, canIssue: true, masked: false, regime: 'PrivatePerson',
  legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A41F205X', addressStreet: 'Via Roma',
  addressCivic: '12', postalCode: '22100', city: 'Como', province: 'CO', countryCode: 'IT',
  stayVatTreatment: 'Standard', defaultGuestDocumentSeries: '{year}', missingFields: [],
};
axios.defaults.adapter = async (config) => {
  const url = config.url ?? '';
  let data = [];
  if (url.endsWith('/fiscal-profiles')) data = [fiscal];
  else if (url.endsWith('/policies')) data = [policy()];
  else if (url === '/owners') data = [{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }];
  else if (url.endsWith('/address')) data = address;
  else if (url.endsWith('/issuer-profile')) data = issuer;
  else if (url.endsWith('/readiness')) data = null;
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
const context = {
  contexts: [{ contextKey: 'account', roleKey: 'org_admin', permissions: [] }],
  activeContext: 'account', isReady: true, setActiveContext: () => {},
  hasPermission: () => true, getDefaultRoute: () => '/app/account',
};
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <WorkspaceContext.Provider value={context}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true }, isLoading: false }}>
        <MemoryRouter initialEntries={[`/app/account/owners/${OWNER_ID}/financial`]}>
          <main className="mx-auto max-w-5xl p-5">
            <Routes><Route path="/app/account/owners/:ownerId/financial" element={<OwnerFinancialProfilePage />} /></Routes>
          </main>
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </WorkspaceContext.Provider>
  </QueryClientProvider>,
);
