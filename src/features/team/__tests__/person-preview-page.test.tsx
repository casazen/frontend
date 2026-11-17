import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { OrgRoleInfo } from '@/types/org-team.types';
import type { PersonRow } from '../people-rows';
import { PersonPreviewPage } from '../person-preview-page';

const state = vi.hoisted(() => ({ rows: [] as PersonRow[], roles: [] as OrgRoleInfo[] }));
vi.mock('../people-rows', () => ({ usePeopleRows: () => ({ rows: state.rows, isLoading: false, isError: false }) }));
vi.mock('@/queries/use-org-team', () => ({
  useOrgRoles: () => ({ data: { roles: state.roles }, isPending: false }),
  useOrgMemberProperties: () => ({ data: { properties: [{ name: 'Casa Lago', granted: true }, { name: 'Casa Sole', granted: true }, { name: 'Privata', granted: false }] }, isPending: false, fetchStatus: 'idle' }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: {} }) }));
vi.mock('../change-role-dialog', () => ({ ChangeRoleDialog: () => null }));
vi.mock('../member-access-dialog', () => ({ MemberAccessDialog: () => null }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

function show() {
  render(<MemoryRouter initialEntries={['/people/m-anna/preview']}><Routes><Route path="/people/:key/preview" element={<PersonPreviewPage />} /></Routes></MemoryRouter>);
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  state.rows = [{ key: 'm-anna', id: 'anna', kind: 'member', name: 'Anna Rossi', email: 'anna@example.com', role: 'Collaborator', areas: ['short-rent'], propertyScope: 'Selected', status: 'Active', isMe: true, since: '', deactivatedAt: null, expiresAt: null, invitedByName: null, propertyCount: 0 }];
  state.roles = [{ role: 'Collaborator', assignable: true, scopeSupported: true, permissionsByContext: { 'short-rent': { roleKey: 'short-rent_collaborator', permissions: ['booking.read', 'property.read'] } }, capabilities: [{ id: 'booking', group: 'short-rent', level: 'Read' }, { id: 'prices', group: 'short-rent', level: 'No' }] }, { role: 'Admin', assignable: true, scopeSupported: false, permissionsByContext: { account: { roleKey: 'account_admin', permissions: ['org.members.manage'] } }, capabilities: [] }];
});

describe('person access preview', () => {
  it('summarizes access before menu details and keeps unavailable areas explicit', () => {
    show();
    const short = screen.getByTestId('preview-area-short-rent');
    expect(within(short).getByText(i18n.t('team.access.available'))).toBeVisible();
    const disclosure = within(short).getByTestId('preview-pages-short-rent');
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(disclosure.querySelector('summary')!);
    expect(disclosure).toHaveAttribute('open');
    expect(screen.getByTestId('preview-cannot-long-rent')).toBeVisible();
    expect(screen.queryByTestId('preview-pages-long-rent')).not.toBeInTheDocument();
  });

  it('lists granted properties separately and keeps excluded properties private', () => {
    show();
    const properties = screen.getByRole('region', { name: i18n.t('team.access.propertiesTitle') });
    expect(within(properties).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Casa Lago', 'Casa Sole']);
    expect(screen.queryByText('Privata')).not.toBeInTheDocument();
    const access = screen.getByTestId('access-preview');
    expect(within(access).getByText(i18n.t('team.capabilities.booking')).tagName).toBe('LI');
    expect(within(access).getByText(i18n.t('team.capabilities.prices')).tagName).toBe('LI');
  });

  it('labels role comparison as a preview and can return to the current role', () => {
    show();
    expect(screen.getByText(i18n.t('team.access.previewHint'))).toBeVisible();
    fireEvent.click(screen.getByTestId('preview-role-Admin'));
    expect(screen.getByTestId('preview-trying')).toBeVisible();
    expect(screen.getByTestId('preview-role-Admin')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('preview-back-today'));
    expect(screen.queryByTestId('preview-trying')).not.toBeInTheDocument();
    expect(screen.getByTestId('preview-role-Collaborator')).toHaveAttribute('aria-pressed', 'true');
  });

  it('a deactivated member has no active access cards or role simulation', () => {
    state.rows[0].status = 'Deactivated';
    show();
    expect(screen.getByTestId('access-preview')).toHaveTextContent(i18n.t('team.preview.deactivated'));
    expect(screen.queryByTestId('preview-areas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-try')).not.toBeInTheDocument();
  });
});
