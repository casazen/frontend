import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { UnreadMessagesBadge } from '../unread-messages-badge';

describe('UnreadMessagesBadge', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('UnreadMessagesBadge_Zero_RendersNothing', () => {
    const { container } = render(<UnreadMessagesBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('UnreadMessagesBadge_Some_ShowsTheNumberAndSaysItInWords', () => {
    render(<UnreadMessagesBadge count={2} />);
    const badge = screen.getByTestId('unread-messages-badge');
    expect(badge).toHaveTextContent('2');
    expect(badge).toHaveTextContent('2 messaggi da leggere');
  });

  it('UnreadMessagesBadge_Single_UsesTheSingularForm', () => {
    render(<UnreadMessagesBadge count={1} />);
    expect(screen.getByTestId('unread-messages-badge')).toHaveTextContent('1 messaggio da leggere');
  });

  it('UnreadMessagesBadge_Above99_IsCapped', () => {
    render(<UnreadMessagesBadge count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
