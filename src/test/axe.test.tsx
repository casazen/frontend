import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { axeViolations, expectNoAxeViolations } from './axe';

describe('axe helper (UI-07)', () => {
  afterEach(() => {
    cleanup();
  });

  it('axeViolations_ButtonWithoutAName_NamesTheRuleAndTheElement', async () => {
    const { container } = render(<button type="button" />);

    const violations = await axeViolations(container);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('button-name');
    expect(violations[0]).toContain('button');
  });

  it('axeViolations_ImageWithoutAlternativeText_IsReported', async () => {
    const { container } = render(<img src="x.png" />);

    expect((await axeViolations(container)).join('\n')).toContain('image-alt');
  });

  it('expectNoAxeViolations_AccessibleMarkup_Passes', async () => {
    const { container } = render(
      <form>
        <label htmlFor="name">Nome</label>
        <input id="name" />
        <button type="submit">Salva</button>
      </form>,
    );

    await expectNoAxeViolations(container);
  });

  it('expectNoAxeViolations_BrokenMarkup_Fails', async () => {
    const { container } = render(<input />);

    await expect(expectNoAxeViolations(container)).rejects.toThrow();
  });
});
