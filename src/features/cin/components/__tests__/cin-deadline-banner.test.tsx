import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { CinDeadlineBanner } from '../cin-deadline-banner';
import { CinSummaryCards } from '../cin-summary-cards';
import type { CinComplianceSummary } from '@/types/cin.types';

/** Summary as `GET /api/properties/cin-compliance` returns it (CO-20): the phase is computed by the backend. */
function summary(overrides: Partial<CinComplianceSummary>): CinComplianceSummary {
  return {
    valid: 1,
    missing: 1,
    invalid: 1,
    daysUntilDeadline: null,
    deadline: null,
    deadlineStatus: 'none',
    hasNonCompliant: true,
    ...overrides,
  };
}

const upcoming = summary({ deadline: '2027-03-01', daysUntilDeadline: 10, deadlineStatus: 'upcoming' });
const dueToday = summary({ deadline: '2027-03-01', daysUntilDeadline: 0, deadlineStatus: 'today' });
const passed = summary({ deadline: '2027-03-01', daysUntilDeadline: -200, deadlineStatus: 'passed' });
const noDeadline = summary({});

describe('CinDeadlineBanner (CO-20)', () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it('CinDeadlineBanner_BeforeTheDeadline_ShowsTheDaysLeft', () => {
    render(<CinDeadlineBanner summary={upcoming} />);

    expect(screen.getByTestId('cin-deadline-message')).toHaveTextContent('Mancano 10 giorni alla scadenza del 1 marzo 2027.');
    expect(screen.getByTestId('cin-deadline-banner')).toHaveTextContent('Hai 2 proprietà senza CIN valido.');
  });

  it('CinDeadlineBanner_OneDayLeft_UsesTheSingular', () => {
    render(<CinDeadlineBanner summary={{ ...upcoming, daysUntilDeadline: 1 }} />);

    expect(screen.getByTestId('cin-deadline-message')).toHaveTextContent('Manca 1 giorno alla scadenza del 1 marzo 2027.');
  });

  it('CinDeadlineBanner_OnTheDeadlineDay_SaysToday', () => {
    render(<CinDeadlineBanner summary={dueToday} />);

    expect(screen.getByTestId('cin-deadline-message')).toHaveTextContent('La scadenza del 1 marzo 2027 è oggi.');
  });

  it('CinDeadlineBanner_AfterTheDeadline_SaysPassedNeverToday', () => {
    render(<CinDeadlineBanner summary={passed} />);

    const message = screen.getByTestId('cin-deadline-message');
    expect(message).toHaveTextContent('La scadenza del 1 marzo 2027 è superata: inserisci il CIN al più presto.');
    expect(screen.getByTestId('cin-deadline-banner')).not.toHaveTextContent(/oggi|Mancano/);
    expect(screen.getByTestId('cin-deadline-banner')).toHaveTextContent('art. 13-ter, c. 9');
  });

  it('CinDeadlineBanner_NoDeadlineConfigured_ShowsTheObligationWithoutADate', () => {
    render(<CinDeadlineBanner summary={noDeadline} />);

    expect(screen.getByTestId('cin-deadline-message')).toHaveTextContent(
      "Il CIN è obbligatorio: va esposto all'esterno dell'immobile e indicato in ogni annuncio.",
    );
    expect(screen.getByTestId('cin-deadline-banner')).not.toHaveTextContent(/scadenza|2027/);
  });

  it('CinDeadlineBanner_English_TranslatesEveryPhase', async () => {
    await i18n.changeLanguage('en');

    const { rerender } = render(<CinDeadlineBanner summary={upcoming} />);
    expect(screen.getByTestId('cin-deadline-message')).toHaveTextContent('10 days left until the March 1, 2027 deadline.');

    rerender(<CinDeadlineBanner summary={passed} />);
    expect(screen.getByTestId('cin-deadline-message')).toHaveTextContent('The March 1, 2027 deadline has passed');

    rerender(<CinDeadlineBanner summary={noDeadline} />);
    expect(screen.getByTestId('cin-deadline-message')).toHaveTextContent('The CIN is mandatory');
  });

  it('CinDeadlineBanner_EveryPropertyCompliant_RendersNothing', () => {
    const { container } = render(<CinDeadlineBanner summary={{ ...passed, missing: 0, invalid: 0, hasNonCompliant: false }} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('CinSummaryCards (CO-20)', () => {
  afterEach(cleanup);

  it('CinSummaryCards_BeforeTheDeadline_ShowsTheDaysLeft', () => {
    render(<CinSummaryCards summary={upcoming} />);

    expect(screen.getByTestId('cin-days-until-deadline')).toHaveTextContent('Mancano 10 giorni');
    expect(screen.getByText('Scadenza del 1 marzo 2027')).toBeInTheDocument();
  });

  it('CinSummaryCards_AfterTheDeadline_ShowsPassedNotZero', () => {
    render(<CinSummaryCards summary={passed} />);

    expect(screen.getByTestId('cin-days-until-deadline')).toHaveTextContent('Superata');
  });

  it('CinSummaryCards_NoDeadlineConfigured_HidesTheDeadlineCard', () => {
    render(<CinSummaryCards summary={noDeadline} />);

    expect(screen.queryByTestId('cin-days-until-deadline')).not.toBeInTheDocument();
    expect(screen.getByTestId('cin-summary-cards')).toHaveTextContent('Non validi');
  });
});
