import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { ComplianceStatusBadge } from '../../compliance-status-badge';
import type { LightState } from '../../lib/compliance-light';
import { ComplianceLight } from '../compliance-light';

afterEach(cleanup);

describe('ComplianceLight (NF-52): color, icon and words, never the color alone', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it.each([
    ['green', 'In regola'],
    ['yellow', 'In corso'],
    ['red', 'Da fare'],
    ['unknown', 'Da verificare'],
  ] as [LightState, string][])('render_%s_ShowsItsWordsAndAnIconAndNotJustAColor', (state, words) => {
    render(<ComplianceLight state={state} data-testid="light" />);

    const light = screen.getByTestId('light');
    expect(light).toHaveTextContent(words);
    expect(light).toHaveAttribute('data-light', state);
    // The icon is decorative (the words say it) and is there: the color is never the only signal.
    expect(light.querySelector('svg')).toBeInTheDocument();
    expect(light.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('render_WithAReason_PutsItInTheAccessibleName', () => {
    render(<ComplianceLight state="red" reason="Alloggiati Web non è ancora stato inviato." />);

    expect(screen.getByRole('img', { name: 'Da fare: Alloggiati Web non è ancora stato inviato.' })).toBeInTheDocument();
  });

  it('render_WithoutAReason_TheNameIsTheLight', () => {
    render(<ComplianceLight state="unknown" />);

    expect(screen.getByRole('img', { name: 'Da verificare' })).toBeInTheDocument();
  });

  it('render_InEnglish_UsesTheEnglishWords', async () => {
    await i18n.changeLanguage('en');
    render(<ComplianceLight state="green" reason="The receipt is archived." />);

    expect(screen.getByRole('img', { name: 'Compliant: The receipt is archived.' })).toHaveTextContent('Compliant');
    await i18n.changeLanguage('it');
  });

  it('render_ALabel_ReplacesTheNameOfTheLight', () => {
    render(<ComplianceLight state="green" label="Attivo" />);

    expect(screen.getByRole('img', { name: 'Attivo' })).toHaveTextContent('Attivo');
    expect(screen.queryByText('In regola')).not.toBeInTheDocument();
  });

  it('render_EveryLight_HasNoAccessibilityViolation', async () => {
    const { container } = render(
      <ul>
        {(['green', 'yellow', 'red', 'unknown'] as LightState[]).map((state) => (
          <li key={state}>
            <ComplianceLight state={state} reason="Un motivo." />
          </li>
        ))}
      </ul>,
    );

    await expectNoAxeViolations(container);
  });
});

describe('ComplianceStatusBadge reuses the vocabulary of the lights', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it.each([
    ['Active', 'Attivo', 'green'],
    ['Pending', 'In attesa', 'yellow'],
    ['Suspended', 'Sospeso', 'red'],
  ] as const)('render_%s_SaysItsOwnWordInTheLookOfTheLight', (status, words, light) => {
    render(<ComplianceStatusBadge status={status} />);

    const badge = screen.getByTestId('compliance-status-badge');
    // The status of the activation, in its own word: it is not the proof a light asks for, so it never says «In regola».
    expect(badge).toHaveTextContent(words);
    expect(badge).not.toHaveTextContent('In regola');
    expect(badge).toHaveAttribute('data-light', light);
    expect(badge.querySelector('svg')).toBeInTheDocument();
  });
});
