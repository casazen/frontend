import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { NO_LIGHTS, type LightSummary } from '../../lib/compliance-light';
import { ComplianceSummaryLine } from '../compliance-summary-line';

const lights = (parts: Partial<LightSummary>): LightSummary => ({ ...NO_LIGHTS, ...parts });

function renderLine(summary: LightSummary, variant?: 'page' | 'home') {
  return render(
    <MemoryRouter>
      <ComplianceSummaryLine lights={summary} variant={variant} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('ComplianceSummaryLine ("Sono in regola?" in one line, NF-52)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('render_NothingNeedsAttentionAndTheServerSentLights_SaysAllClearInTheToneOfSuccess', () => {
    renderLine(lights({ green: 4, lightsOn: true }));

    const line = screen.getByTestId('compliance-summary-line');
    expect(line).toHaveTextContent('Tutto in regola');
    expect(line).toHaveAttribute('data-tone', 'success');
  });

  // Green is what the server proves: with no light at all an empty list says nothing of what nobody evaluated (traffic light off, older server).
  it.each(['page', 'home'] as const)('render_%s_NothingToDoButNoLightAtAll_SaysNothingNeverAllClear', (variant) => {
    const { container } = renderLine(lights({}), variant);

    expect(container).toBeEmptyDOMElement();
  });

  it('render_NothingToDoButSomethingWithNoLight_IsNotAllClear', () => {
    // An item with no light is «da verificare»: it counts as something to do, whatever the other counters say.
    renderLine(lights({ needs: 1, unknown: 1 }));

    expect(screen.getByTestId('compliance-summary-line')).toHaveTextContent('1 cosa da fare');
  });

  it.each([
    [1, '1 cosa da fare'],
    [5, '5 cose da fare'],
  ])('render_%i_ThingsToDo_IsInTheRightPlural', (needs, text) => {
    renderLine(lights({ needs, red: needs }));

    expect(screen.getByTestId('compliance-summary-line')).toHaveTextContent(text);
  });

  it('render_PageWithSeveralLights_SaysWhatEachCounts', () => {
    renderLine(lights({ needs: 6, red: 3, yellow: 2, unknown: 1 }));

    expect(screen.getByTestId('compliance-summary-line')).toHaveTextContent('6 cose da fare: 3 da sistemare, 2 in corso, 1 da verificare');
  });

  it('render_PageWithOneKindOfLight_IsOnlyTheTotalNotTheSameNumberTwice', () => {
    renderLine(lights({ needs: 3, red: 3 }));

    const line = screen.getByTestId('compliance-summary-line');
    expect(line).toHaveTextContent('3 cose da fare');
    expect(line).not.toHaveTextContent('da sistemare');
  });

  it.each([
    [lights({ needs: 2, red: 1, yellow: 1 }), 'danger'],
    [lights({ needs: 1, yellow: 1 }), 'warning'],
    // Nothing could be said about them: not red, not green, and never «tutto in regola».
    [lights({ needs: 2, unknown: 2 }), 'info'],
    [lights({ needs: 40, unlisted: 40 }), 'info'],
  ])('render_%j_HasTheToneOfItsWorstLight_%s', (summary, tone) => {
    renderLine(summary);

    expect(screen.getByTestId('compliance-summary-line')).toHaveAttribute('data-tone', tone);
    expect(screen.getByTestId('compliance-summary-line')).not.toHaveTextContent('Tutto in regola');
  });

  it('render_Home_IsOneLineWithTheWayToThePageOfTheAdempimenti', () => {
    renderLine(lights({ needs: 3, red: 2, yellow: 1 }), 'home');

    const line = screen.getByTestId('home-compliance-line');
    // On the Home only the total: what each light counts is on the page.
    expect(line).toHaveTextContent('3 cose da fare');
    expect(line).not.toHaveTextContent('da sistemare');
    const link = screen.getByTestId('home-compliance-all');
    expect(link).toHaveAttribute('href', '/app/short-rent/compliance');
    expect(link.className).toContain('min-h-11');
  });

  it('render_Home_AllClear_SaysIt', () => {
    renderLine(lights({ green: 2, lightsOn: true }), 'home');

    expect(screen.getByTestId('home-compliance-line')).toHaveTextContent('Tutto in regola');
  });

  it('render_InEnglish_UsesTheEnglishWords', async () => {
    await i18n.changeLanguage('en');
    renderLine(lights({ needs: 5, red: 3, yellow: 2 }));

    expect(screen.getByTestId('compliance-summary-line')).toHaveTextContent('5 things to do: 3 to fix, 2 in progress');
    await i18n.changeLanguage('it');
  });

  it('render_Both_HaveNoAccessibilityViolation', async () => {
    const { container } = renderLine(lights({ needs: 3, red: 2, yellow: 1 }), 'home');

    await expectNoAxeViolations(container);
  });
});
