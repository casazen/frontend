import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ContextBootstrapDto } from '@/api/contexts';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { useAuth } from '@/hooks/use-auth';
import { NoAccessPage } from '../no-access-page';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));

const forceReauth = vi.fn();

function context(contextKey: ContextBootstrapDto['contextKey'], defaultRoute: string): ContextBootstrapDto {
  return { contextKey, displayName: 'Amministrazione', roleKey: contextKey, permissions: [], defaultRoute };
}

function renderPage(contexts: ContextBootstrapDto[], isReady = true) {
  const workspace: WorkspaceContextValue = {
    contexts,
    activeContext: contexts[0]?.contextKey ?? null,
    isReady,
    setActiveContext: vi.fn(),
    hasPermission: () => true,
    getDefaultRoute: (contextKey) => contexts.find((c) => c.contextKey === contextKey)?.defaultRoute ?? '/app',
  };
  render(
    <WorkspaceContext.Provider value={workspace}>
      <MemoryRouter initialEntries={['/app/no-access']}>
        <Routes>
          <Route path="/app/no-access" element={<NoAccessPage />} />
          <Route path="/app/choose-context" element={<p data-testid="picker" />} />
          <Route path="*" element={<p data-testid="area-home" />} />
        </Routes>
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

// A 403 on a read opens this page (`setApiForbiddenHandler`). It told everyone «your account has no workspace, sign in again», also a
// person with four areas who had only been refused one page (the staff console of an account without the Auth0 Admin role).
describe('NoAccessPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ forceReauth } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('NoAccess_PersonWithSeveralAreas_SaysThePageIsClosedAndLeadsBackToTheAreas', () => {
    renderPage([context('account', '/app/account'), context('admin', '/app/admin')]);

    expect(screen.getByText('Non hai accesso a questa pagina')).toBeInTheDocument();
    expect(screen.queryByText('Nessun accesso disponibile')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Torna alle tue aree' }));
    expect(screen.getByTestId('picker')).toBeInTheDocument();
  });

  it('NoAccess_PersonWithOneArea_LeadsBackToItsHome', () => {
    renderPage([context('short-rent', '/app/short-rent')]);

    fireEvent.click(screen.getByRole('link', { name: 'Torna alla home' }));
    expect(screen.getByTestId('area-home')).toBeInTheDocument();
  });

  it('NoAccess_PersonWithAreas_CanStillSignInAgainToRefreshARoleJustGiven', () => {
    renderPage([context('account', '/app/account'), context('admin', '/app/admin')]);

    fireEvent.click(screen.getByRole('button', { name: 'Accedi di nuovo' }));
    expect(forceReauth).toHaveBeenCalledTimes(1);
  });

  it('NoAccess_PersonWithoutAreas_KeepsTheNoWorkspaceMessage', () => {
    renderPage([]);

    expect(screen.getByText('Nessun accesso disponibile')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accedi di nuovo' }));
    expect(forceReauth).toHaveBeenCalledTimes(1);
  });

  it('NoAccess_WorkspaceStillLoading_ShowsNeitherMessage', () => {
    renderPage([], false);

    expect(screen.queryByText('Nessun accesso disponibile')).not.toBeInTheDocument();
    expect(screen.queryByText('Non hai accesso a questa pagina')).not.toBeInTheDocument();
  });
});
