/* eslint-disable react-refresh/only-export-components -- A helper of the tests: it has a component of its own (the probe of the address) next to the functions the tests call. */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ListView, type ListViewProps } from '../list-view';
import type { ListDefinition, ListViewsScope } from '../list-types';
import { STAYS, stayList, type Stay } from './list-fixtures';

export const SCOPE: ListViewsScope = { userId: 'auth0|tester', context: 'short-rent' };

/** The address, and a way to go back, for a test to look at: the list writes its state there. */
function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="search">{location.search}</output>
      <output data-testid="pathname">{location.pathname}</output>
      <button type="button" data-testid="probe-back" onClick={() => void navigate(-1)}>
        back
      </button>
    </>
  );
}

export interface HarnessOptions {
  initial?: string;
  list?: ListDefinition<Stay>;
  rows?: readonly Stay[];
  props?: Partial<ListViewProps<Stay>>;
}

/** The list in a memory router, in English. */
export function renderList({ initial = '/app/short-rent/bookings', list = stayList(), rows = STAYS, props = {} }: HarnessOptions = {}) {
  const view = render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initial]}>
        <ListView list={list} rows={rows} viewsScope={SCOPE} {...props} />
        <Probe />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return { ...view, list };
}

/** The address now (`?chip=pending`). */
export const addressNow = () => screen.getByTestId('search').textContent ?? '';
export const goBack = () => fireEvent.click(screen.getByTestId('probe-back'));

/** The table, and the list of cards, of the list of stays. */
export const stayTable = () => screen.getByRole('table', { name: 'Stays' });
export const stayCards = () => screen.getByRole('list', { name: 'Stays' });

/** The names in the first column of the table, in the order they are in. */
export const namesInTable = () => within(stayTable()).getAllByRole('rowheader').map((cell) => cell.textContent);

/** Opens the menu of a button the way a keyboard does (Radix opens on the pointer going down, which a click does not send). */
export async function openMenu(button: HTMLElement) {
  fireEvent.keyDown(button, { key: 'Enter' });
  return screen.findByRole('menu');
}

/** Makes `matchMedia` say that the screen is a phone (under 48rem), and puts it back afterwards. */
export function pretendToBeAPhone() {
  const original = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === '(width < 48rem)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  return () => Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: original });
}

/** Lets a handler that ends in a promise settle. */
export const settle = () => act(async () => undefined);
