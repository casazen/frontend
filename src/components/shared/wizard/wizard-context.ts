import { createContext, useContext } from "react";
import type { To } from "react-router-dom";

/** What the content of a step may ask of the wizard around it (the summary links back to a step, for example). */
export interface WizardContextValue {
  stepId: string;
  stepIndex: number;
  steps: ReadonlyArray<{ id: string; label: string }>;
  /** Link to a step (`?step=<id>`): a real link, so it can be opened in a new tab and followed with "back". */
  hrefFor: (stepId: string) => To;
  goTo: (stepId: string) => void;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

/** The wizard the component is inside of, or `null` outside of one. */
export function useOptionalWizard(): WizardContextValue | null {
  return useContext(WizardContext);
}
