import { act } from '@testing-library/react';
import { takeOpener } from '@/components/shared/detail-drawer/detail-opener';

export async function settleDrawer() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  takeOpener();
}
