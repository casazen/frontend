import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import i18n from '@/i18n/config';
import type { AccountPropertyRow } from '../account-properties-model';
import { AccountPropertyDrawerContent } from '../account-property-drawer';
import { useAccountPropertiesList } from '../account-properties-list';

const fixture = vi.hoisted(() => ({ row: {} as AccountPropertyRow }));
vi.mock('../use-account-property-rows', () => ({
  useAccountPropertyRights: () => ({ shortRead: true, shortWrite: true, longRead: true, longWrite: true }),
  useAccountPropertyRows: () => ({ rows: [fixture.row], members: [], membersKnown: true, isLoading: false, isError: false }),
  useMemberAccess: () => ({ granted: new Map(), isPending: false, isError: false }),
}));
vi.mock('../responsible-picker', () => ({ ResponsiblePicker: () => null }));
vi.mock('@/features/properties/mode/components/scheduled-change-notice', () => ({ ScheduledChangeNotice: () => null }));

function Wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}><MemoryRouter>{children}</MemoryRouter></I18nextProvider>;
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  fixture.row = {
    property: { id: 'p1', name: 'Casa Zen', city: 'Roma', address: 'Via Roma', rentalMode: 'Short' },
    mode: 'Short', state: null, lease: null, needsCompleting: false, missing: [], advice: [], responsible: null, people: 0,
  } as AccountPropertyRow;
});
afterEach(cleanup);

describe('removed short-to-long property conversion (#915)', () => {
  it('removes the drawer action and its empty section for short rentals', () => {
    render(<AccountPropertyDrawerContent id="p1" />, { wrapper: Wrapper });
    expect(screen.queryByTestId('account-property-drawer-mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Altre azioni')).not.toBeInTheDocument();
    expect(screen.getByTestId('account-property-drawer-open')).toBeInTheDocument();
  });

  it('keeps long-to-short available for long rentals', () => {
    fixture.row = { ...fixture.row, mode: 'Long', property: { ...fixture.row.property, rentalMode: 'Long' } };
    render(<AccountPropertyDrawerContent id="p1" />, { wrapper: Wrapper });
    expect(screen.getByTestId('account-property-drawer-mode')).toHaveAttribute('href', '/app/long-rent/properties/p1/mode?from=account');
    expect(screen.getByTestId('account-property-drawer-mode')).toHaveTextContent('Passa ad affitto breve');
  });

  it('removes the list entry only for short rentals', () => {
    const { result } = renderHook(() => useAccountPropertiesList({
      rights: { shortRead: true, shortWrite: true, longRead: true, longWrite: true },
      membersKnown: true, peopleKnown: true, onAssignOne: vi.fn(), onAssignMany: vi.fn(), onRestore: vi.fn(), onDelete: vi.fn(), onWho: vi.fn(), onAdd: undefined,
    }), { wrapper: Wrapper });
    const menu = result.current.menu!;
    expect(menu(fixture.row)).not.toContainEqual(expect.objectContaining({ id: 'mode' }));
    expect(menu({ ...fixture.row, mode: 'Long' })).toContainEqual(expect.objectContaining({ id: 'mode', label: 'Passa ad affitto breve' }));
  });
});
