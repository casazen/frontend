import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { useUiStore } from '@/store/ui-store';
import { stubViewportWidth } from '@/test/viewport';
import { AppToaster } from '../app-toaster';

const ABOVE_THE_BAR = 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 0.75rem)';

async function showAToast() {
  act(() => {
    toast('Salvato');
  });
  await screen.findByText('Salvato');
  return document.querySelector('[data-sonner-toaster]') as HTMLElement;
}

describe('AppToaster (UI-04b)', () => {
  beforeEach(() => {
    useUiStore.setState({ bottomBarVisible: false });
  });

  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
    cleanup();
    vi.unstubAllGlobals();
    useUiStore.setState({ bottomBarVisible: false });
  });

  it('AppToaster_Computer_KeepsTheToastsAtTheTopRight', async () => {
    stubViewportWidth(1280);
    render(<AppToaster />);

    const toaster = await showAToast();

    expect(toaster).toHaveAttribute('data-y-position', 'top');
    expect(toaster).toHaveAttribute('data-x-position', 'right');
  });

  it('AppToaster_Tablet_KeepsTheToastsAtTheTopRight', async () => {
    stubViewportWidth(820);
    useUiStore.setState({ bottomBarVisible: true });
    render(<AppToaster />);

    // The bar is the phone's: a tablet has the sidebar, and the toasts stay where they were.
    const toaster = await showAToast();

    expect(toaster).toHaveAttribute('data-y-position', 'top');
    expect(toaster).toHaveAttribute('data-x-position', 'right');
  });

  it('AppToaster_PhoneWithTheBar_PutsTheToastsAtTheBottomCenterAboveIt', async () => {
    stubViewportWidth(390);
    useUiStore.setState({ bottomBarVisible: true });
    render(<AppToaster />);

    const toaster = await showAToast();

    expect(toaster).toHaveAttribute('data-y-position', 'bottom');
    expect(toaster).toHaveAttribute('data-x-position', 'center');
    // Over 600 px the library reads `offset`, under it `mobileOffset`: both lift the toasts above the bar.
    expect(toaster.style.getPropertyValue('--offset-bottom')).toBe(ABOVE_THE_BAR);
    expect(toaster.style.getPropertyValue('--mobile-offset-bottom')).toBe(ABOVE_THE_BAR);
  });

  it('AppToaster_PhoneWithTheBar_KeepsTheOtherMarginsOfTheLibrary', async () => {
    stubViewportWidth(390);
    useUiStore.setState({ bottomBarVisible: true });
    render(<AppToaster />);

    const toaster = await showAToast();

    expect(toaster.style.getPropertyValue('--offset-top')).toBe('24px');
    expect(toaster.style.getPropertyValue('--offset-left')).toBe('24px');
    expect(toaster.style.getPropertyValue('--mobile-offset-top')).toBe('16px');
    expect(toaster.style.getPropertyValue('--mobile-offset-left')).toBe('16px');
  });

  it('AppToaster_PhoneWithoutTheBar_KeepsTheToastsAtTheTopRightLikeTheComputer', async () => {
    // The public pages and the login have no bar; the booking bar of the public site and the cookie notice are at the bottom.
    stubViewportWidth(390);
    render(<AppToaster />);

    const toaster = await showAToast();

    expect(toaster).toHaveAttribute('data-y-position', 'top');
    expect(toaster).toHaveAttribute('data-x-position', 'right');
    expect(toaster.style.getPropertyValue('--offset-bottom')).toBe('24px');
    expect(toaster.style.getPropertyValue('--mobile-offset-bottom')).toBe('16px');
  });

  it('AppToaster_BarAppearsAndGoes_TheToastsFollowIt', async () => {
    stubViewportWidth(390);
    render(<AppToaster />);
    const toaster = await showAToast();
    expect(toaster).toHaveAttribute('data-y-position', 'top');

    act(() => useUiStore.setState({ bottomBarVisible: true }));
    expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute('data-y-position', 'bottom');

    act(() => useUiStore.setState({ bottomBarVisible: false }));
    expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute('data-y-position', 'top');
  });

  it('AppToaster_WindowTurnedFromPhoneToTablet_MovesTheToastsToTheTop', async () => {
    const viewport = stubViewportWidth(390);
    useUiStore.setState({ bottomBarVisible: true });
    render(<AppToaster />);
    const toaster = await showAToast();
    expect(toaster).toHaveAttribute('data-y-position', 'bottom');

    act(() => viewport.resize(1024));

    expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute('data-y-position', 'top');
  });

  it('AppToaster_ToastsKeepTheirRichColors', async () => {
    stubViewportWidth(1280);
    render(<AppToaster />);

    act(() => {
      toast.error('Non salvato');
    });
    await screen.findByText('Non salvato');

    expect(document.querySelector('[data-sonner-toast]')).toHaveAttribute('data-rich-colors', 'true');
  });
});
