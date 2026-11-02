import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { httpError } from '../../__tests__/lease-test-utils';
import { periodConflictOf } from '../period-conflict';
import { PeriodConflictNotice } from '../period-conflict-notice';

const CONFLICT = { conflictingLeaseId: 'lease-9', conflictingFrom: '2026-11-01', conflictingTo: '2029-10-31' };

describe('PeriodConflictNotice (LR-OVERLAP): two leases of one property cannot cover the same days', () => {
  afterEach(cleanup);

  it('says in plain words which days the other lease covers, and opens that lease', async () => {
    await i18n.changeLanguage('it');
    render(
      <MemoryRouter>
        <PeriodConflictNotice conflict={CONFLICT} />
      </MemoryRouter>,
    );

    const notice = screen.getByTestId('lease-period-conflict');
    expect(notice).toHaveTextContent("Per questo immobile c'è già un contratto dal 1 nov 2026 al 31 ott 2029.");
    expect(notice).toHaveTextContent('Due contratti non possono coprire gli stessi giorni: apri quello esistente o cambia le date.');
    expect(screen.getByRole('link', { name: 'Apri il contratto esistente' })).toHaveAttribute('href', '/app/long-rent/leases/lease-9');
  });

  it('has the same words in English', async () => {
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter>
        <PeriodConflictNotice conflict={CONFLICT} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('lease-period-conflict')).toHaveTextContent(
      'This property already has a lease from Nov 1, 2026 to Oct 31, 2029. Two leases cannot cover the same days: open the existing one or change the dates.',
    );
    expect(screen.getByRole('link', { name: 'Open the existing lease' })).toBeInTheDocument();
    await i18n.changeLanguage('it');
  });

  it('reads the other lease from a 409 lease_period_overlaps and from nothing else', () => {
    expect(periodConflictOf(httpError(409, { code: 'lease_period_overlaps', ...CONFLICT }))).toEqual(CONFLICT);
    expect(periodConflictOf(httpError(409, { code: 'lease_draft_conflict' }))).toBeNull();
    expect(periodConflictOf(httpError(409, { code: 'lease_period_overlaps' }))).toBeNull();
    expect(periodConflictOf(new Error('not a response'))).toBeNull();
    expect(periodConflictOf(null)).toBeNull();
  });
});
