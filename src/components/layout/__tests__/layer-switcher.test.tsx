import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { LayerSwitcher } from '../layer-switcher';

vi.mock('@/hooks/use-app-layer-context', () => ({
  useAppLayerContext: vi.fn(),
}));

import { useAppLayerContext } from '@/hooks/use-app-layer-context';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('LayerSwitcher', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en');
  });

  it('renders nothing when layer switching is disabled', () => {
    vi.mocked(useAppLayerContext).mockReturnValue({
      activeLayer: 'short-stay',
      effectiveLayer: 'short-stay',
      canSwitchLayer: false,
      setLayer: vi.fn(),
      getDefaultHomePath: () => '/',
    });

    const { container } = renderWithI18n(<LayerSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders segmented control for dual-role users', () => {
    vi.mocked(useAppLayerContext).mockReturnValue({
      activeLayer: 'short-stay',
      effectiveLayer: 'short-stay',
      canSwitchLayer: true,
      setLayer: vi.fn(),
      getDefaultHomePath: () => '/',
    });

    renderWithI18n(<LayerSwitcher />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Short-stay' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Long-term' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls setLayer when a segment is clicked', () => {
    const setLayer = vi.fn();
    vi.mocked(useAppLayerContext).mockReturnValue({
      activeLayer: 'short-stay',
      effectiveLayer: 'short-stay',
      canSwitchLayer: true,
      setLayer,
      getDefaultHomePath: () => '/',
    });

    renderWithI18n(<LayerSwitcher />);
    fireEvent.click(screen.getByRole('tab', { name: 'Long-term' }));
    expect(setLayer).toHaveBeenCalledWith('long-term');
  });
});
