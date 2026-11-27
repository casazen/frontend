import { useEffect } from 'react';
import { useUiStore } from '@/store/ui-store';

/**
 * A guided flow with steps says it is on screen: +1 in the count `openWizards` of the UI store when the component mounts and -1 when it
 * unmounts, once for each instance (ADR-025-R7). While the count is above zero the popup alerts wait in their queue and nothing is drawn.
 *
 * `WizardShell` calls it, so every wizard built on it counts. A flow with steps inside the shell that has a frame of its own calls it
 * itself (the contract wizard, the activation of a property, the fiscal profile, the activation of a supplier): a new one that does not
 * use `WizardShell` has to do the same, or the popup is drawn over it. The count lasts as long as the component does, the confirmation
 * screen included.
 */
export function useWizardOpenFlag(): void {
  useEffect(() => {
    const { wizardOpened, wizardClosed } = useUiStore.getState();
    wizardOpened();
    return wizardClosed;
  }, []);
}
