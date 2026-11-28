import { useEffect } from 'react';
import { useUiStore } from '@/store/ui-store';

export function useWizardOpenFlag(): void {
  useEffect(() => {
    const { wizardOpened, wizardClosed } = useUiStore.getState();
    wizardOpened();
    return wizardClosed;
  }, []);
}
