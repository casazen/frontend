import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ContextBootstrapDto } from '@/api/contexts';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { ContextPickerPage } from '../context-picker-page';

vi.mock('@/hooks/use-empty-workspace-recovery', () => ({ useEmptyWorkspaceRecovery: () => false }));
const profile = vi.hoisted(() => ({ value: null as { orgId?: string | null; onboardingRequired?: boolean } | null }));
vi.mock('@/queries/use-users', () => ({ useMe: () => ({ data: profile.value, isLoading: false }) }));

function context(contextKey: ContextBootstrapDto['contextKey'], defaultRoute: string): ContextBootstrapDto {
  return { contextKey, displayName: `Area ${contextKey}`, roleKey: contextKey, permissions: [], defaultRoute };
}

function renderPicker(contexts: ContextBootstrapDto[], isReady = true, setActiveContext = vi.fn()) {
  const workspace: WorkspaceContextValue = {
    contexts,
    activeContext: contexts[0]?.contextKey ?? null,
    isReady,
    setActiveContext,
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

describe('the area picker carries the app-ready test id (UI-00)', () => {
  afterEach(() => {
    cleanup();
    profile.value = null;
  });

  it('ContextPicker_SeveralAreas_IsTheAppReadyScreen', () => {
    renderPicker([context('short-rent', '/app/short-rent'), context('long-rent', '/app/long-rent/leases')]);

    expect(screen.getByTestId('app-ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Affitti brevi/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Affitti lunghi/ })).toBeInTheDocument();
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

  it('offers host setup to an admin with no organization', () => {
    profile.value = { orgId: null, onboardingRequired: true };
    renderPicker([context('admin', '/app/admin')]);
    expect(screen.getByRole('link', { name: /Attiva affitti brevi e lunghi/ })).toHaveAttribute('href', '/onboarding');
    expect(screen.getByRole('button', { name: /^Console staff/ })).toBeInTheDocument();
  });
});

describe('the area picker names the areas as the area selector does', () => {
  afterEach(() => {
    cleanup();
  });

  it('ContextPicker_AdminAndAccount_TwoDistinctNamesInTheOrderOfTheSelector', () => {
    renderPicker([
      { ...context('account', '/app/account'), displayName: 'Amministrazione' },
      { ...context('admin', '/app/admin'), displayName: 'Amministrazione' },
      context('short-rent', '/app/short-rent'),
    ]);

    const names = screen.getAllByRole('button').map((button) => button.querySelector('.font-semibold')?.textContent);
    expect(names).toEqual(['Affitti brevi', 'Amministrazione', 'Console staff']);
    expect(screen.getByRole('button', { name: /^Console staff/ })).toHaveTextContent(
      'Utenti, fornitori, processi e controlli di conformità della piattaforma',
    );
  });

  it('ContextPicker_ClickOnAnArea_OpensThatArea', () => {
    const setActiveContext = vi.fn();
    renderPicker([context('account', '/app/account'), context('admin', '/app/admin')], true, setActiveContext);

    fireEvent.click(screen.getByRole('button', { name: /^Console staff/ }));

    expect(setActiveContext).toHaveBeenCalledWith('admin');
  });
});
