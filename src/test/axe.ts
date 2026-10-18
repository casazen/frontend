import { expect } from 'vitest';
import { configureAxe } from 'vitest-axe';

/**
 * axe-core on a piece of the page that a test rendered (UI-07): what a screen reader and the keyboard need from a component,
 * that is names, roles, labels, ids that point at something that exists, the structure of lists and tables.
 *
 * Two rules are off here because jsdom cannot answer them, not because they do not matter. `color-contrast` needs a layout
 * engine and the painted colors: it is checked in a real browser by the Playwright specs (`@axe-core/playwright`), and the
 * pairs of the tokens by `styles/__tests__/tokens`. `region` wants all the content inside a landmark, which a component
 * rendered alone never is.
 */
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
});

/** One line per rule that failed, naming the elements, so that a red test says what to fix. */
export async function axeViolations(root: Element): Promise<string[]> {
  const { violations } = await axe(root);
  return violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} -> ${violation.nodes
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
  );
}

/** The component (or the page) has no accessibility violation that axe can find without a browser. */
export async function expectNoAxeViolations(root: Element): Promise<void> {
  expect(await axeViolations(root)).toEqual([]);
}
