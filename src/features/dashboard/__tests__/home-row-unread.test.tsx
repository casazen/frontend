import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { HostThreadSummary } from '@/types/guest-message.types';
import { HomeRowItem } from '../components/home-row';
import { buildTodoRows } from '../lib/home-model';

const THREAD: HostThreadSummary = {
  bookingId: 'b-1',
  bookingCode: 'ABCDE-12345',
  propertyId: 'p-1',
  propertyName: 'Casa Mare',
  guestName: 'Sofia Marino',
  checkInDate: '2026-10-10',
  checkOutDate: '2026-10-12',
  state: 'Open',
  lastMessageAt: '2026-10-23T08:00:00Z',
  lastMessageSender: 'Guest',
  lastGuestMessagePreview: 'Ciao!',
  unreadCount: 3,
  needsReply: true,
};

function rows(thread: HostThreadSummary) {
  const t = i18n.getFixedT('it');
  const today = { todo: { items: [] }, approvals: { items: [] } } as never;
  return buildTodoRows(today, [], { propertyId: '', canWrite: true, hasPermission: () => true, threads: [thread] }, { t, locale: 'it' });
}

describe('the unread counter of a thread on the Home (SR-12)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('buildTodoRows_Thread_CarriesItsUnreadCount', () => {
    expect(rows(THREAD)[0].unread).toBe(3);
  });

  it('HomeRowItem_ThreadWithUnreadMessages_ShowsTheCounter', () => {
    render(
      <MemoryRouter>
        <ul>
          <HomeRowItem row={rows(THREAD)[0]} />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('unread-messages-badge')).toHaveTextContent('3 messaggi da leggere');
  });

  it('HomeRowItem_ThreadAlreadyRead_ShowsNoCounter', () => {
    render(
      <MemoryRouter>
        <ul>
          <HomeRowItem row={rows({ ...THREAD, unreadCount: 0 })[0]} />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('unread-messages-badge')).not.toBeInTheDocument();
  });
});
