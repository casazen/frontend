import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../src/i18n/config';
import '../../src/styles/globals.css';
import { AuthAppProviders } from '../../src/contexts/auth-bridge';
import { WorkspaceContext } from '../../src/contexts/workspace-context';
import { ContextSidebar } from '../../src/components/layout/context-sidebar';
import { PeoplePage } from '../../src/features/team/people-page';
import { InvitePage } from '../../src/features/team/invite/invite-page';

const account = { contextKey: 'account', roleKey: 'org_owner', displayName: 'Amministrazione', permissions: ['org.members.manage'], defaultRoute: '/app/account' };
const workspace = {
  contexts: [account], activeContext: 'account', isReady: true, setActiveContext: () => {},
  hasPermission: (area, permission) => area === 'account' && account.permissions.includes(permission),
  getDefaultRoute: () => account.defaultRoute,
};
const query = new URLSearchParams(location.search);
const start = query.has('invite') ? '/app/account/people/invite' : '/app/account';
const step = query.has('done') ? '?step=fatto' : '';
createRoot(document.getElementById('root')).render(
  <AuthAppProviders>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WorkspaceContext.Provider value={workspace}>
        <MemoryRouter initialEntries={[start + step]}>
          <div className="flex">
            <ContextSidebar contextKey="account" />
            <main className="min-w-0 flex-1 p-5">
              <Routes>
                <Route path="/app/account" element={<h1>Amministrazione</h1>} />
                <Route path="/app/account/people" element={<PeoplePage />} />
                <Route path="/app/account/people/invite" element={<InvitePage />} />
              </Routes>
            </main>
          </div>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>
  </AuthAppProviders>,
);
