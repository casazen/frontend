import { createContext, useContext } from "react";
import type { To } from "react-router-dom";

export interface WizardContextValue {
  stepId: string;
  stepIndex: number;
  steps: ReadonlyArray<{ id: string; label: string }>;
  hrefFor: (stepId: string) => To;
  goTo: (stepId: string) => void;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useOptionalWizard(): WizardContextValue | null {
  return useContext(WizardContext);
}
