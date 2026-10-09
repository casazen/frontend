import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Checks that the specs of the new primitives (UI-07) share: what axe finds in a real browser, and whether something sticks
 * out of a phone.
 */

/**
 * The letters are widened by 8 % of the font size (about what Verdana or DejaVu Sans add to Segoe UI), so that a check of
 * width does not depend on the fonts installed on the machine that runs it: the L2 suite runs on Linux in CI and on Windows
 * where the specs are written (the lesson of UI-04a).
 */
export const WIDER_LETTERS = 'body, body * { letter-spacing: 0.08em !important; }';

/** One line per rule that failed and the elements it found, so that a red run says what to fix (CI keeps no trace). */
export async function axeViolations(page: Page, options: { include?: string; exclude?: string[] } = {}): Promise<string[]> {
  let builder = new AxeBuilder({ page });
  if (options.include) builder = builder.include(options.include);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  const { violations } = await builder.analyze();
  return violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n    ${violation.nodes
        .slice(0, 12)
        .map((node) => `${node.target.join(' ')} -> ${node.failureSummary?.replace(/\s+/g, ' ').slice(0, 220)}`)
        .join('\n    ')}`,
  );
}

/** The page, as it is now, has no accessibility violation that axe can find in a browser (colors and contrast included). */
export async function expectNoAxeViolations(page: Page, options: { include?: string; exclude?: string[] } = {}) {
  expect(await axeViolations(page, options)).toEqual([]);
}

/** Nothing makes the page scroll sideways, and (to say what does if something does) nothing ends past the right edge. */
export async function expectNothingSticksOut(page: Page, where: string, within = 'body') {
  const { scroll, outside } = await page.evaluate((selector) => {
    const root = document.documentElement;
    const viewport = root.clientWidth;
    const found = Array.from(document.querySelectorAll(`${selector} *`))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        // Hidden text for screen readers and what scrolls inside its own box do not count.
        if (box.width === 0 || element.closest('[class*="sr-only"], .overflow-x-auto')) return false;
        return box.right > viewport + 0.5;
      })
      .slice(0, 6)
      .map((element) => `<${element.tagName.toLowerCase()}> "${(element.textContent ?? '').trim().slice(0, 30)}" ends at ${Math.round(element.getBoundingClientRect().right)}`);
    return { scroll: root.scrollWidth - viewport, outside: found };
  }, within);
  expect(scroll, `${where}: the page does not scroll sideways (sticking out: ${outside.join('; ') || 'nothing'})`).toBeLessThanOrEqual(0);
}

/** An element is entirely inside the screen, as wide as it is. */
export async function expectInsideTheScreen(page: Page, element: Locator, where: string) {
  const box = await element.boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${where}: it is on the page`).not.toBeNull();
  expect(box!.x, `${where}: it starts inside the screen`).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width, `${where}: it ends inside the screen`).toBeLessThanOrEqual(viewport!.width + 0.5);
}

/**
 * Waits for the animations of the page to end: a box that is still sliding in has no place to measure yet. The ones that never
 * end (a skeleton that pulses, a spinner) are not waited for.
 */
export async function untilStill(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .every((animation) => animation.playState !== 'running'),
  );
}
