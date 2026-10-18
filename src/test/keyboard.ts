import { vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';

/**
 * What a Tab does to the focus: a key press, then the focus on `element`, which a browser then reports as `:focus-visible`
 * (a click that focuses an element is not). jsdom does not answer that reliably (its answer depends on which queries
 * the test made before, and on a heuristic of the last key pressed), so the element says it, as the browser would.
 */
export function tabTo(element: HTMLElement) {
  const matches = element.matches.bind(element);
  vi.spyOn(element, 'matches').mockImplementation((selector: string) => selector === ':focus-visible' || matches(selector));
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => element.focus());
}
