import { vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';

export function tabTo(element: HTMLElement) {
  const matches = element.matches.bind(element);
  vi.spyOn(element, 'matches').mockImplementation((selector: string) => selector === ':focus-visible' || matches(selector));
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => element.focus());
}
