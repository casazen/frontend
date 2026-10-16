import { render, screen } from '@testing-library/react';
import { CasaZenLogo, CasaZenMark } from '../casazen-mark';

describe('CasaZen brand', () => {
  it('the logo has one accessible name', () => {
    render(<CasaZenLogo />);
    expect(screen.getByRole('img', { name: 'CasaZen' })).toBeInTheDocument();
  });

  it('collapsed, the logo is only the mark', () => {
    render(<CasaZenLogo collapsed />);
    expect(screen.getByTestId('casazen-logo')).not.toHaveTextContent('casazen');
  });

  it('the mark is decorative and takes its size', () => {
    const { container } = render(<CasaZenMark size={72} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '72');
  });
});
