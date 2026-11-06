import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { useUiStore } from '@/store/ui-store';
import { LeaseWizardFrame } from '../lease-wizard-frame';

describe('LeaseWizardFrame and the popup alerts (ADR-025-R7)', () => {
  afterEach(cleanup);

  it('LeaseWizardFrame_OnScreen_HoldsThePopupAlertsBackUntilTheWizardIsLeft', async () => {
    await i18n.changeLanguage('it');

    const { unmount } = render(
      <LeaseWizardFrame
        stepper={<nav />}
        position={{ current: 2, total: 7 }}
        title="Scegli la casa"
        summary="Serve a collegare il contratto alla casa."
        footer={<button type="button">Avanti</button>}
      >
        <p>campi</p>
      </LeaseWizardFrame>,
    );

    // Every screen of the contract wizard is drawn in this frame: while one is on screen the popup waits.
    expect(screen.getByTestId('lease-wizard')).toBeInTheDocument();
    expect(useUiStore.getState().openWizards).toBeGreaterThan(0);

    unmount();

    expect(useUiStore.getState().openWizards).toBe(0);
  });
});
