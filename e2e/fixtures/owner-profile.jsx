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

const query = new URLSearchParams(window.location.search);
const blocked = query.get('scenario') === 'blocked';
const masked = query.get('scenario') === 'masked';
const forwarded = new URLSearchParams();
for (const key of ['tab', 'period']) if (query.has(key)) forwarded.set(key, query.get(key));

const fiscal = masked
  ? profile({ validFrom: '2025-06-01' })
  : profile({
      masked: false,
      validFrom: '2025-06-01',
      legalName: 'Marta Rossi',
      fiscalCode: 'RSSMRT80A41F205X',
      legalAddress: 'Via Roma 12, Como',
      bankAccountReference: blocked ? null : 'IT60X0542811101000000123456',
    });
const earlier = profile({ id: 'a1000000-0000-4000-8000-000000000002', masked: false, validFrom: '2024-01-01', validTo: '2025-05-31', legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A41F205X' });
const rule = blocked ? policy({ approved: false, approvedAt: null, approvedByName: null }) : policy({ parameters: { ...policy().parameters, withholdingApplies: true, withholdingRatePercent: 21, withholdingTaxCode: '1919', grossBaseComponents: ['stay_gross'] } });
const address = { street: 'Via Roma', buildingNumber: '12', postalCode: '22100', town: 'Como', province: 'CO', country: 'IT' };
const issuer = {
  ownerId: OWNER_ID, exists: true, canIssue: !blocked, masked: false, regime: 'PrivatePerson',
  legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A41F205X', addressStreet: 'Via Roma',
  addressCivic: '12', postalCode: '22100', city: 'Como', province: 'CO', countryCode: 'IT',
  stayVatTreatment: 'Standard', defaultGuestDocumentSeries: '{year}', missingFields: blocked ? ['fiscalCode'] : [],
};
const mandate = (overrides) => ({
  id: 'c1000000-0000-4000-8000-000000000001', ownerId: OWNER_ID, ownershipId: null, validFrom: '2026-10-01', validTo: null,
  commissionPercent: 20, commissionBase: 'GrossExclTouristTax', commissionIncludesVat: false, cleaningFlatRate: 70, linenFlatRate: 15,
  passthroughPaymentFees: false, withholdingTreatment: 'Deductible', monthlyFrequency: 1, hasDocument: true, documentUploaded: true,
  createdAt: '2026-09-20T08:00:00Z', createdByUserId: 'auth0|admin', ...overrides,
});
const mandates = blocked ? [] : [mandate(), mandate({ id: 'c1000000-0000-4000-8000-000000000002', validFrom: '2025-01-01', validTo: '2026-09-30', commissionPercent: 18, cleaningFlatRate: null, linenFlatRate: null })];
const readiness = {
  asOf: '2026-11-27',
  summary: { financialReady: !blocked },
  owners: [{
    ownerId: OWNER_ID, displayName: 'Marta Rossi', accountingReady: !blocked,
    reasons: blocked ? [
      { dimension: 'payment', code: 'iban_missing', field: null, propertyId: null },
      { dimension: 'mandate', code: 'mandate_missing', field: null, propertyId: 'p-1' },
      { dimension: 'ownership', code: 'shares_shortfall', field: null, propertyId: 'p-1' },
    ] : [],
    warnings: [],
  }],
  properties: [{ propertyId: 'p-1', name: 'Casa sul Lago', ownershipReady: !blocked, reasons: [], issues: blocked ? [{ kind: 'shortfall', from: '2026-01-01', to: null, totalPercent: 60, ownerId: null }] : [] }],
};
const taxChecks = { ownerId: OWNER_ID, applies: true, managedUnits: 1, externalUnits: 0, totalUnits: 1, maxUnits: 2, presumedBusiness: false };

axios.defaults.adapter = async (config) => {
  const url = config.url ?? '';
  let data = [];
  if (url.endsWith('/fiscal-profiles')) data = [fiscal, earlier];
  else if (url.endsWith('/policies')) data = [rule];
  else if (url === '/owners') data = [{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }];
  else if (url.endsWith('/address')) data = address;
  else if (url.endsWith('/issuer-profile')) data = issuer;
  else if (url.endsWith('/mandates')) data = mandates;
  else if (url.endsWith('/tax-checks')) data = taxChecks;
  else if (url.endsWith('/readiness')) data = readiness;
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
const context = {
  contexts: [{ contextKey: 'account', roleKey: 'org_admin', permissions: [] }],
  activeContext: 'account', isReady: true, setActiveContext: () => {},
  hasPermission: () => true, getDefaultRoute: () => '/app/account',
};
const entry = `/app/account/owners/${OWNER_ID}/financial${forwarded.size ? `?${forwarded}` : ''}`;
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <WorkspaceContext.Provider value={context}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true, taxReportingExports: true }, isLoading: false }}>
        <MemoryRouter initialEntries={[entry]}>
          <main className="mx-auto max-w-5xl p-5">
            <Routes><Route path="/app/account/owners/:ownerId/financial" element={<OwnerFinancialProfilePage />} /></Routes>
          </main>
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </WorkspaceContext.Provider>
  </QueryClientProvider>,
);
