import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import '../../src/i18n/config';
import '../../src/styles/globals.css';
import {OwnerMandateSection} from '../../src/features/owners/components/owner-mandate-form';
import axios from '../../src/lib/axios';
// Production component, synthetic API responses only. This fixture never accesses an external account or document.
const ownerId = 'a1000000-0000-4000-8000-000000000001';
axios.defaults.adapter = async (config) => {
  const url = config.url ?? '';
  let data = [];
  if (url.endsWith('/read-document')) data = {
    validFrom: null, commissionPercent: 20, commissionBase: 'GrossExclTouristTax', commissionIncludesVat: false,
    cleaningFlatRate: 70, linenFlatRate: 15, passthroughPaymentFees: false, currency: 'EUR',
  };
  return {data, status: 200, statusText: 'OK', headers: {}, config};
};
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
    <main className="mx-auto max-w-5xl p-5">
      <h1 className="mb-6 text-2xl font-semibold">Mandato proprietario</h1>
      <OwnerMandateSection ownerId={ownerId} currency="EUR" canManage />
    </main>
  </QueryClientProvider>,
);
