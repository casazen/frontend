import { act } from '@testing-library/react';
import { takeOpener } from '@/components/shared/detail-drawer/detail-opener';

/**
 * For the tests of the detail drawer (UI-15), after `cleanup()`: the focus scope of a dialog that was open says goodbye one tick
 * after it unmounts, and it would take the opener of the next test with it. Lets it, and forgets who opened the drawer.
 */
export async function settleDrawer() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  takeOpener();
}
