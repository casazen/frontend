import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import i18n from '@/i18n/config';
import type { BillingSetup } from '@/types';
import { BILLING_STEPS } from '../billing-wizard-ids';
import { draftLeftOut, initialValues, platformDefaultsOf, stepSave, withProposal } from '../billing-wizard-model';
import { PORTAL_SOURCES, type BillingWizardValues } from '../billing-wizard-schema';
import { TouristTaxStep } from '../steps/tourist-tax-step';
import { emptySetup, italianSetup, item, section, setupOf, swissSetup } from './billing-fixtures';

const TODAY = '2026-11-19';

function swissWith(touristTax: Record<string, unknown>): BillingSetup {
  const base = swissSetup();
  return setupOf(
    base.sections.map((entry) =>
      entry.section === 'touristTax'
        ? section('touristTax', touristTax, 'platformCollectedTouristTaxChannels' in touristTax ? [] : [item('tourist_tax_channels_unconfirmed', 'touristTax', 'unconfirmed')])
        : entry,
    ),
  );
}

const start = (setup: BillingSetup) => initialValues(setup, { organizationName: 'Casa Lugano SA', today: TODAY });
const answers = (setup: BillingSetup) => start(setup).touristTaxCollectors;

describe('the tourist tax of a new Swiss setup starts from the portals that collect it by default (FIX/FE-OWNERS-ADOPT, S009)', () => {
  it('InitialValues_NewSetup_ChoosesThePortalsThatCollectItByDefault_AndLeavesTheOthersToAnswer', () => {
    const collectors = answers(swissWith({ confirmed: false, defaultPlatformCollectedTouristTaxChannels: ['Airbnb'] }));

    expect(collectors.Airbnb).toBe('portal');
    expect(PORTAL_SOURCES.filter((portal) => collectors[portal] === '')).toEqual(['BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda', 'OtherChannel']);
    expect(platformDefaultsOf(swissWith({ confirmed: false, defaultPlatformCollectedTouristTaxChannels: ['Airbnb'] }))).toEqual(['Airbnb']);
  });

  it('InitialValues_AListTheIssuerSaved_IsNeverOverriddenByTheDefault', () => {
    const saved = swissWith({ confirmed: true, platformCollectedTouristTaxChannels: ['BookingCom'], defaultPlatformCollectedTouristTaxChannels: ['Airbnb'] });
    const collectors = answers(saved);

    expect(collectors.BookingCom).toBe('portal');
    expect(collectors.Airbnb).toBe('host');
    expect(PORTAL_SOURCES.filter((portal) => collectors[portal] === 'portal')).toEqual(['BookingCom']);
    expect(platformDefaultsOf(saved)).toEqual([]);

    const none = swissWith({ confirmed: true, platformCollectedTouristTaxChannels: [], defaultPlatformCollectedTouristTaxChannels: ['Airbnb'] });
    expect(Object.values(answers(none)).every((collector) => collector === 'host')).toBe(true);
    expect(platformDefaultsOf(none)).toEqual([]);
  });

  it('InitialValues_ConfirmedWithoutAList_ProposesNothing', () => {
    const odd = swissWith({ confirmed: true, defaultPlatformCollectedTouristTaxChannels: ['Airbnb'] });

    expect(Object.values(answers(odd)).every((collector) => collector === '')).toBe(true);
    expect(platformDefaultsOf(odd)).toEqual([]);
  });

  it('PlatformDefaultsOf_AnIssuerWithNoDefaultOrAPortalThatIsNotAsked_ProposesOnlyWhatTheStepAsks', () => {
    expect(platformDefaultsOf(undefined)).toEqual([]);
    expect(platformDefaultsOf(italianSetup())).toEqual([]);
    expect(platformDefaultsOf(emptySetup())).toEqual([]);
    expect(platformDefaultsOf(swissWith({ confirmed: false, defaultPlatformCollectedTouristTaxChannels: ['Airbnb', 'Direct', 'SomethingNew'] }))).toEqual(['Airbnb']);
  });

  it('StepSave_AProposalIsNotAnAnswer_ADraftKeepsNoListUntilEveryPortalIsAnswered', () => {
    const values: BillingWizardValues = start(swissWith({ confirmed: false, defaultPlatformCollectedTouristTaxChannels: ['Airbnb'] }));
    const initial = values;

    // «Salva ed esci» with the proposal and nothing else: nothing is saved, so the part «Fatturazione» of the guide is not told done.
    expect(stepSave(BILLING_STEPS.touristTax, values, { draft: true, initial })).toBeNull();
    const answered: BillingWizardValues = {
      ...values,
      touristTaxCollectors: Object.fromEntries(PORTAL_SOURCES.map((portal) => [portal, portal === 'Airbnb' ? 'portal' : 'host'])) as BillingWizardValues['touristTaxCollectors'],
    };
    expect(stepSave(BILLING_STEPS.touristTax, answered)?.request).toEqual({ platformCollectedTouristTaxChannels: ['Airbnb'] });
  });

  // The country is chosen in this very wizard: the form started with nothing and the proposal is written into it when the step opens. What the draft compares with holds the proposal too, so that a
  // person who leaves the step as it is has written nothing: no list is saved (even when the proposal covers every portal) and nothing «was left out».
  it('StepSave_AProposalThatArrivedAfterTheWizardOpened_IsNotWhatThePersonWrote', () => {
    const opened = start(swissWith({ confirmed: false }));
    const now = swissWith({ confirmed: false, defaultPlatformCollectedTouristTaxChannels: [...PORTAL_SOURCES] });
    const everyPortal = Object.fromEntries(PORTAL_SOURCES.map((portal) => [portal, 'portal'])) as BillingWizardValues['touristTaxCollectors'];
    const asTheStepLeavesIt: BillingWizardValues = { ...opened, touristTaxCollectors: everyPortal };

    const baseline = withProposal(opened, platformDefaultsOf(now));
    expect(baseline.touristTaxCollectors).toEqual(everyPortal);
    expect(stepSave(BILLING_STEPS.touristTax, asTheStepLeavesIt, { draft: true, initial: baseline })).toBeNull();
    const changed: BillingWizardValues = { ...asTheStepLeavesIt, touristTaxCollectors: { ...everyPortal, Vrbo: 'host' } };
    expect(stepSave(BILLING_STEPS.touristTax, changed, { draft: true, initial: baseline })?.request.platformCollectedTouristTaxChannels).not.toContain('Vrbo');

    const partial = swissWith({ confirmed: false, defaultPlatformCollectedTouristTaxChannels: ['Airbnb'] });
    const withAirbnb: BillingWizardValues = { ...opened, touristTaxCollectors: { ...opened.touristTaxCollectors, Airbnb: 'portal' } };
    expect(draftLeftOut(BILLING_STEPS.touristTax, withAirbnb, { initial: withProposal(opened, platformDefaultsOf(partial)), onRecord: { vatNumber: false, fiscalCode: false } })).toEqual([]);
    expect(draftLeftOut(BILLING_STEPS.touristTax, withAirbnb, { initial: opened, onRecord: { vatNumber: false, fiscalCode: false } })).toEqual(['touristTaxCollectors']);
    expect(withProposal(opened, [])).toBe(opened);
  });
});

function Harness({ collectors, proposed }: { collectors: BillingWizardValues['touristTaxCollectors']; proposed?: readonly string[] }) {
  const form = useForm<BillingWizardValues>({ defaultValues: { ...start(swissSetup()), touristTaxCollectors: collectors } });
  return (
    <FormProvider {...form}>
      <TouristTaxStep country="CH" proposed={proposed} />
    </FormProvider>
  );
}

const unanswered = () => Object.fromEntries(PORTAL_SOURCES.map((portal) => [portal, '' as const])) as BillingWizardValues['touristTaxCollectors'];
const choice = (portal: string) => (screen.getByTestId(`billing-collector-${portal}`) as HTMLSelectElement).value;

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => cleanup());

describe('the step «Tassa di soggiorno» of a Swiss issuer', () => {
  it('TouristTaxStep_ThePortalsThatCollectItByDefault_AreChosenInTheAnswers_AndTheOthersStayToAnswer', async () => {
    render(<Harness collectors={unanswered()} proposed={['Airbnb']} />);

    expect(await screen.findByTestId('billing-tourist-tax-proposed')).toHaveTextContent('Airbnb');
    expect(choice('Airbnb')).toBe('portal');
    for (const portal of PORTAL_SOURCES.filter((name) => name !== 'Airbnb')) expect(choice(portal)).toBe('');
  });

  it('TouristTaxStep_AnAnswerAlreadyThere_IsNeverOverriddenByTheProposal', () => {
    render(<Harness collectors={{ ...unanswered(), Airbnb: 'host', Vrbo: 'portal' }} proposed={['Airbnb', 'Vrbo']} />);

    expect(choice('Airbnb')).toBe('host');
    expect(choice('Vrbo')).toBe('portal');
    expect(choice('BookingCom')).toBe('');
  });

  it('TouristTaxStep_NoProposal_AsksEveryPortal_AndSaysNothingOfADefault', () => {
    render(<Harness collectors={unanswered()} />);

    for (const portal of PORTAL_SOURCES) expect(choice(portal)).toBe('');
    expect(screen.queryByTestId('billing-tourist-tax-proposed')).toBeNull();
  });
});
