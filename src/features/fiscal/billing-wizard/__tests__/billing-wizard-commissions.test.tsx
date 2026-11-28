import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import i18n from '@/i18n/config';
import type { ChannelCommissionRuleSet } from '@/types';
import { commissionRulesRequest, initialValues } from '../billing-wizard-model';
import type { BillingWizardValues } from '../billing-wizard-schema';
import { CommissionPercents } from '../steps/commission-percents';
import { swissSetup } from './billing-fixtures';

const TODAY = '2026-11-14';

const SET: ChannelCommissionRuleSet = {
  rules: [{ id: 'r-booking', channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: null, createdAt: '2026-01-01T00:00:00Z' }],
  channels: [
    { channel: 'Airbnb', percent: 15, base: 'GrossExclTouristTax', isDefault: true },
    { channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', isDefault: false, ruleId: 'r-booking', validFrom: '2026-01-01', validTo: null },
    { channel: 'Vrbo', percent: null, isDefault: false },
  ],
};

function Harness() {
  const form = useForm<BillingWizardValues>({ defaultValues: initialValues(swissSetup(), { organizationName: 'Casa Lugano SA', today: TODAY }) });
  return (
    <FormProvider {...form}>
      <CommissionPercents set={SET} />
    </FormProvider>
  );
}

const box = (channel: string) => screen.getByTestId(`billing-commission-${channel}`);
const empty = (channel: string) => fireEvent.change(box(channel), { target: { value: '' } });
const keeps = () => i18n.t('billingWizard.channels.commissions.keepsInForce', { percent: '15,5' });

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the percent of a portal whose rule is in force (E11/F02/US01/T01, ⚖ R2)', () => {
  it('CommissionPercents_ThePercentOfARuleInForceIsEmptied_SaysTheRuleStaysAndWhatItIs', () => {
    render(<Harness />);
    expect(box('BookingCom')).toHaveValue('15.5');
    expect(screen.queryByText(keeps())).not.toBeInTheDocument();

    empty('BookingCom');

    expect(box('BookingCom')).toHaveValue('');
    expect(screen.getByText(keeps())).toBeInTheDocument();
    fireEvent.change(box('BookingCom'), { target: { value: '16' } });
    expect(screen.queryByText(keeps())).not.toBeInTheDocument();
  });

  it('CommissionPercents_APortalThatHasNoRuleInForceIsEmptied_IsNotToldThatARuleStays', () => {
    render(<Harness />);

    empty('Airbnb');
    empty('Vrbo');

    expect(box('Airbnb')).toHaveValue('');
    expect(screen.queryByText(keeps())).not.toBeInTheDocument();
    expect(screen.queryByText(/resta in vigore/)).not.toBeInTheDocument();
  });

  it('CommissionRules_ThePercentOfARuleInForceIsEmptied_ChangesNothingAndTheRuleStays', () => {
    expect(commissionRulesRequest(SET, { BookingCom: '' }, TODAY)).toEqual([
      { channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: null },
      { channel: 'Airbnb', percent: 15, base: 'GrossExclTouristTax', validFrom: TODAY },
    ]);
    expect(commissionRulesRequest({ ...SET, channels: SET.channels.filter((row) => row.channel === 'BookingCom') }, { BookingCom: '' }, TODAY)).toBeNull();
  });
});
