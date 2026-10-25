import type { TFunction, i18n as I18nInstance } from 'i18next';
import { stepKey } from './wizard-model';
import type { LeaseOrigin } from '@/types';

type Exists = Pick<I18nInstance, 'exists'>;

/** The words at the top of a screen of the wizard (LR-WIZ-1): what is done here, in a line, and what to have at hand. */
export interface StepWords {
  /** The thing the person does, with a verb: «Scrivi chi firma». */
  title: string;
  /** One sentence: what is done here and why it is needed. */
  summary: string;
  /** The documents and the data to have at hand; none on a screen that only waits. */
  inHand?: string;
}

/**
 * The words of a screen, from the translations under `base` (`title`, `summary`, `inHand`, and `inHandImported` where a contract that
 * is already signed needs other things at hand). Read by key, so a step cannot be added without its words: the test of the wizard
 * walks through every step.
 */
export function stepWordsAt(t: TFunction, i18n: Exists, base: string, imported = false): StepWords {
  const inHandImported = `${base}.inHandImported`;
  const inHand = imported && i18n.exists(inHandImported) ? inHandImported : `${base}.inHand`;
  return {
    title: t(`${base}.title`),
    summary: t(`${base}.summary`),
    inHand: i18n.exists(inHand) ? t(inHand) : undefined,
  };
}

/** The words of a step of the wizard by its number: the signature reads differently for a contract that is already signed. */
export function stepWords(t: TFunction, i18n: Exists, step: number, origin: LeaseOrigin): StepWords {
  return stepWordsAt(t, i18n, `leaseWizardGuide.steps.${stepKey(step, origin)}`, origin === 'Imported');
}
