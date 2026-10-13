import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { NAV_ICONS } from '@/lib/nav-icons';
import { NavIcon } from '../nav-icon';

describe('NavIcon (UI-04a)', () => {
  afterEach(() => {
    cleanup();
  });

  it('NavIcon_KnownName_DrawsThatIconHiddenFromScreenReaders', () => {
    const { container } = render(<NavIcon name="Sun" className="h-5 w-5" />);

    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass('h-5', 'w-5', 'lucide-sun');
  });

  it('NavIcon_NoNameOrUnknownName_FallsBackToTheDashboardIcon', () => {
    const { container } = render(
      <>
        <NavIcon />
        <NavIcon name="NoSuchIcon" />
      </>,
    );

    expect([...container.querySelectorAll('svg')].map((icon) => icon.getAttribute('class'))).toEqual([
      expect.stringContaining('lucide-layout-dashboard'),
      expect.stringContaining('lucide-layout-dashboard'),
    ]);
  });

  it('NavIcon_AreaIcons_ExistInTheTableOfIcons', () => {
    for (const name of ['Sun', 'Home', 'Wrench', 'Shield']) {
      expect(NAV_ICONS[name]).toBeDefined();
    }
  });
});
