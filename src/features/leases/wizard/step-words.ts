import type { TFunction, i18n as I18nInstance } from 'i18next';
import { stepKey } from './wizard-model';
import type { LeaseOrigin } from '@/types';

type Exists = Pick<I18nInstance, 'exists'>;

export interface StepWords {
  title: string;
  summary: string;
  inHand?: string;
}

export function stepWordsAt(t: TFunction, i18n: Exists, base: string, imported = false): StepWords {
  const inHandImported = `${base}.inHandImported`;
  const inHand = imported && i18n.exists(inHandImported) ? inHandImported : `${base}.inHand`;
  return {
    title: t(`${base}.title`),
    summary: t(`${base}.summary`),
    inHand: i18n.exists(inHand) ? t(inHand) : undefined,
  };
}

export function stepWords(t: TFunction, i18n: Exists, step: number, origin: LeaseOrigin): StepWords {
  return stepWordsAt(t, i18n, `leaseWizardGuide.steps.${stepKey(step, origin)}`, origin === 'Imported');
}
