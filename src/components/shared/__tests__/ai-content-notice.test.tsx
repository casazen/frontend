import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiContentNotice } from '../ai-content-notice';

describe('AiContentNotice (EU AI Act transparency, AC9)', () => {
  it('renders nothing by default (visible defaults to false)', () => {
    const { container } = render(<AiContentNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when visible=false', () => {
    const { container } = render(<AiContentNotice visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the transparency notice when visible=true', () => {
    render(<AiContentNotice visible={true} />);
    expect(screen.getByTestId('ai-content-notice')).toBeInTheDocument();
    expect(screen.getByText('Descrizione generata con AI')).toBeInTheDocument();
  });

  it('has the correct test id for E2E targeting', () => {
    render(<AiContentNotice visible={true} />);
    const notice = screen.getByTestId('ai-content-notice');
    expect(notice.tagName.toLowerCase()).toBe('p');
  });
});
