import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  AlloggiatiStatusBadge,
} from '../components/alloggiati-status-badge';
import { getAlloggiatiStatusLabel } from '../alloggiati-status.utils';

afterEach(() => {
  cleanup();
});

describe('AlloggiatiStatusBadge (#1 AC9)', () => {
  it('renders Pending status in Italian', () => {
    render(<AlloggiatiStatusBadge status="Pending" />);
    expect(screen.getByTestId('alloggiati-status-badge')).toHaveTextContent('In attesa');
  });

  it('renders Submitted status', () => {
    render(<AlloggiatiStatusBadge status="Submitted" />);
    expect(screen.getByTestId('alloggiati-status-badge')).toHaveTextContent('Inviato');
  });

  it('renders Confirmed status', () => {
    render(<AlloggiatiStatusBadge status="Confirmed" />);
    expect(screen.getByTestId('alloggiati-status-badge')).toHaveTextContent('Confermato');
  });

  it('renders Failed status', () => {
    render(<AlloggiatiStatusBadge status="Failed" />);
    expect(screen.getByTestId('alloggiati-status-badge')).toHaveTextContent('Errore');
  });

  it('renders overdue label when isOverdue is true', () => {
    render(<AlloggiatiStatusBadge status="Pending" isOverdue />);
    expect(screen.getByTestId('alloggiati-status-badge')).toHaveTextContent('Scaduto');
  });

  it('getAlloggiatiStatusLabel returns overdue over status', () => {
    expect(getAlloggiatiStatusLabel('Confirmed', true)).toBe('Scaduto');
    expect(getAlloggiatiStatusLabel('Failed', false)).toBe('Errore');
  });
});
