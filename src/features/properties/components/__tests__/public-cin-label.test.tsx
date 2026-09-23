import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicCinLabel } from '../public-cin-label';

describe('PublicCinLabel (guest-facing CIN)', () => {
  it('PublicCinLabel_ValidCin_ShowsCodeOnly', () => {
    render(<PublicCinLabel cinStatus="Valid" cinCode="IT058091C27G5FFZDZ" />);
    expect(screen.getByTestId('public-cin')).toHaveTextContent('CIN: IT058091C27G5FFZDZ');
    expect(screen.queryByText(/valido/i)).not.toBeInTheDocument();
  });

  it('PublicCinLabel_InvalidCin_RendersNothingForGuests', () => {
    const { container } = render(<PublicCinLabel cinStatus="Invalid" cinCode="IT123450123456789" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('PublicCinLabel_MissingCin_RendersNothing', () => {
    const { container } = render(<PublicCinLabel cinStatus="Missing" cinCode={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
