import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { UseMutationResult } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import type { OwnerMandateTemplate, OwnerMandateTemplateResult } from '@/types';
import { initialValues } from '../billing-wizard-model';
import type { BillingWizardValues } from '../billing-wizard-schema';
import { MandateStep } from '../steps/mandate-step';
import { swissSetup } from './billing-fixtures';

type Apply = UseMutationResult<OwnerMandateTemplateResult, unknown, OwnerMandateTemplate>;

const TODAY = '2026-11-14';

function applier(result: OwnerMandateTemplateResult = { created: 3, skipped: 0, createdOwnerIds: [], skippedOwnerIds: [] }) {
  const mutateAsync = vi.fn<(template: OwnerMandateTemplate) => Promise<OwnerMandateTemplateResult>>().mockResolvedValue(result);
  return { mutateAsync, mutation: { mutateAsync, isPending: false, isError: false, error: null } as unknown as Apply };
}

function Harness({ apply, overrides = {} }: { apply: Apply; overrides?: Partial<BillingWizardValues> }) {
  const form = useForm<BillingWizardValues>({
    defaultValues: { ...initialValues(swissSetup(), { organizationName: 'Casa Lugano SA', today: TODAY }), mandateCommissionPercent: '20', ...overrides },
  });
  return (
    <FormProvider {...form}>
      <MandateStep currency="CHF" ownersWithoutMandate={3} apply={apply} busy={false} />
    </FormProvider>
  );
}

const press = (testId: string) => fireEvent.click(screen.getByTestId(testId));

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the standard mandate is applied as the form says it when the person confirms (E11/F02/US01/T01)', () => {
  // Money rule: the action gives the mandate to EVERY owner that has none, and the fields stay open while the confirmation is up. A percent emptied after the confirmation was
  // asked for is no mandate: nothing is sent, and above all not a mandate of 0%.
  it('MandateStep_APercentEmptiedAfterTheConfirmationWasAsked_SendsNothingAndSaysWhatIsWrongOnTheField', async () => {
    const { mutateAsync, mutation } = applier();
    render(<Harness apply={mutation} />);

    press('billing-mandate-apply-button');
    expect(await screen.findByTestId('billing-mandate-confirm')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('billing-mandate-percent'), { target: { value: '' } });
    press('billing-mandate-confirm-yes');

    expect(await screen.findByText(i18n.t('billingWizard.errors.percent'))).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId('billing-mandate-confirm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billing-mandate-result')).not.toBeInTheDocument();
  });

  it('MandateStep_AValueChangedAfterTheConfirmationWasAsked_IsAppliedAsTheFormSaysNow', async () => {
    const { mutateAsync, mutation } = applier();
    render(<Harness apply={mutation} />);

    press('billing-mandate-apply-button');
    expect(await screen.findByTestId('billing-mandate-confirm')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('billing-mandate-percent'), { target: { value: '18,5' } });
    press('billing-mandate-confirm-yes');

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ validFrom: TODAY, commissionPercent: 18.5, commissionIncludesVat: false, passthroughPaymentFees: false });
    expect(await screen.findByTestId('billing-mandate-result')).toHaveTextContent(i18n.t('billingWizard.mandate.apply.result', { count: 3, skipped: 0 }));
  });

  it('MandateStep_ABlankPercentWhenTheActionIsAskedFor_NeverOpensTheConfirmation', async () => {
    const { mutateAsync, mutation } = applier();
    render(<Harness apply={mutation} overrides={{ mandateCommissionPercent: '' }} />);

    press('billing-mandate-apply-button');

    expect(await screen.findByText(i18n.t('billingWizard.errors.percent'))).toBeInTheDocument();
    expect(screen.queryByTestId('billing-mandate-confirm')).not.toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
