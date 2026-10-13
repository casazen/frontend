import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ContextBootstrapDto } from '@/api/contexts';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { ContextPickerPage } from '../context-picker-page';

vi.mock('@/hooks/use-empty-workspace-recovery', () => ({ useEmptyWorkspaceRecovery: () => false }));

function context(contextKey: ContextBootstrapDto['contextKey'], defaultRoute: string): ContextBootstrapDto {
  return { contextKey, displayName: `Area ${contextKey}`, roleKey: contextKey, permissions: [], defaultRoute };
}

function renderPicker(contexts: ContextBootstrapDto[], isReady = true) {
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
      <MemoryRouter initialEntries={['/app/choose-context']}>
        <Routes>
          <Route path="/app/choose-context" element={<ContextPickerPage />} />
          <Route path="*" element={<p data-testid="home" />} />
        </Routes>
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

// A user with several areas lands here after the login, on a screen without a shell: the e2e logins (e2e/auth.setup.ts)
// wait for the same test id as on the header of the shells (UI-00).
describe('the area picker carries the app-ready test id (UI-00)', () => {
  afterEach(() => {
    cleanup();
  });

  it('ContextPicker_SeveralAreas_IsTheAppReadyScreen', () => {
    renderPicker([context('short-rent', '/app/short-rent'), context('long-rent', '/app/long-rent/leases')]);

    expect(screen.getByTestId('app-ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Area short-rent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Area long-rent' })).toBeInTheDocument();
  });

  it('ContextPicker_WorkspaceStillLoading_IsNotAppReadyYet', () => {
    renderPicker([context('short-rent', '/app/short-rent'), context('long-rent', '/app/long-rent/leases')], false);

    expect(screen.queryByTestId('app-ready')).not.toBeInTheDocument();
  });

  it('ContextPicker_SingleArea_LeavesForTheAreaWithoutShowingThePicker', () => {
    renderPicker([context('long-rent', '/app/long-rent/leases')]);

    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('app-ready')).not.toBeInTheDocument();
  });
});
