import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import * as api from '@/api/owner-issuer-profiles.api';
import { ownerAccountingApi } from '@/api/owner-accounting.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { OwnerIssuersStep } from '@/features/fiscal/billing-wizard/steps/owner-issuers-step';
import i18n from '@/i18n/config';
import { OWNER_ISSUER_KEY } from '@/queries/use-owner-issuer-profile';
import type { OwnerIssuerProfile } from '@/types';
import { OwnerIssuerProfileSection } from '../components/owner-issuer-profile-form';

const env = vi.hoisted(() => ({ flags: {} as Record<string, boolean> }));

vi.mock('@/api/owner-issuer-profiles.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/owner-issuer-profiles.api')>();
  return { ...actual, getOwnerIssuerProfile: vi.fn(), saveOwnerIssuerProfile: vi.fn() };
});
vi.mock('@/api/owner-accounting.api', () => ({
  ownerAccountingApi: { listOwners: vi.fn(), listFiscalProfiles: vi.fn(), getAddress: vi.fn() },
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, ...env.flags }, isLoading: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const OWNER_ID = 'a0000000-0000-4000-8000-000000000001';
const OTHER_ID = 'a0000000-0000-4000-8000-000000000002';

const profile = (overrides: Partial<OwnerIssuerProfile> = {}): OwnerIssuerProfile => ({
  ownerId: OWNER_ID,
  exists: true,
  canIssue: true,
  masked: false,
  regime: 'PrivatePerson',
  legalName: 'Marta Rossi',
  fiscalCode: 'RSSMRT80A41F205X',
  vatNumber: null,
  addressStreet: 'Via Roma',
  addressCivic: '12',
  postalCode: '22100',
  city: 'Como',
  province: 'CO',
  countryCode: 'IT',
  fatturaPaRegimeCode: null,
  effectiveRegimeCode: null,
  stayVatTreatment: 'Standard',
  guestDocumentSeries: null,
  defaultGuestDocumentSeries: '{year}',
  stampDutyReference: null,
  issuerSdiRecipientCode: null,
  issuerPec: null,
  missingFields: [],
  stayRatePercent: null,
  ...overrides,
});

const MASKED = profile({ masked: true, legalName: '••••ssi', fiscalCode: '••••205X', addressStreet: '••••oma', addressCivic: '••••12', postalCode: '••••100' });

const read = vi.mocked(api.getOwnerIssuerProfile);
const write = vi.mocked(api.saveOwnerIssuerProfile);
const owners = vi.mocked(ownerAccountingApi.listOwners);

function renderInto(element: ReturnType<typeof createElement>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { ...render(createElement(QueryClientProvider, { client }, element)), client };
}

function httpFailure(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, { status, data: { status }, statusText: '', headers: {}, config });
}

const NO_PROFILE = (): OwnerIssuerProfile =>
  profile({ exists: false, canIssue: false, regime: null, legalName: null, fiscalCode: null, addressStreet: null, addressCivic: null, postalCode: null, city: null, province: null });

async function readAgain(client: ReturnType<typeof renderInto>['client']) {
  await act(async () => {
    await client.invalidateQueries({ queryKey: [OWNER_ISSUER_KEY, OWNER_ID] });
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.flags = { fiscalDocumentIssuance: true };
  await i18n.changeLanguage('it');
  owners.mockResolvedValue([
    { id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' },
    { id: OTHER_ID, firstName: 'Luca', lastName: 'Bianchi' },
  ]);
});

afterEach(() => cleanup());

describe('the issuer profile of an owner follows the permissions of the server (E17/F03/US01/T01, NF-116, NF-118)', () => {
  it('OwnerIssuerProfile_WhenTheServerMasksIt_IsReadOnly_NoFormNoSaveAndNothingIsWritten', async () => {
    read.mockResolvedValue(MASKED);
    renderInto(createElement(OwnerIssuerProfileSection, { ownerId: OWNER_ID }));

    const section = await screen.findByTestId('owner-issuer-section');
    expect(await within(section).findByTestId('owner-issuer-masked-notice')).toBeInTheDocument();
    expect(within(section).getByTestId('owner-issuer-fact-legalName')).toHaveTextContent('••••ssi');
    expect(within(section).queryByTestId('owner-issuer-form')).toBeNull();
    expect(within(section).queryByTestId('owner-issuer-save')).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('OwnerIssuerProfile_WhenTheServerRefusesIt_IsToldAsNotForYou_NeverAnEmptyForm', async () => {
    // A 403 of the read is `null` (the shared client would otherwise send the whole app to the page of no access).
    read.mockResolvedValue(null);
    renderInto(createElement(OwnerIssuerProfileSection, { ownerId: OWNER_ID }));

    expect(await screen.findByTestId('owner-issuer-not-for-you')).toHaveTextContent(i18n.t('ownerIssuer.notForYou'));
    expect(screen.queryByTestId('owner-issuer-form')).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('OwnerIssuerProfile_WhileTheIssuanceIsOff_DrawsNothingAndAsksNothing', async () => {
    env.flags = {};
    read.mockResolvedValue(profile());
    const { container } = renderInto(createElement(OwnerIssuerProfileSection, { ownerId: OWNER_ID }));

    expect(container).toBeEmptyDOMElement();
    expect(read).not.toHaveBeenCalled();
  });

  it('OwnerIssuerProfile_ForWhoMayChangeIt_SavesTheWholeProfileInItalyAndSaysWhatIsStillMissing', async () => {
    read.mockResolvedValue(profile({ exists: false, canIssue: false, regime: null, legalName: null, fiscalCode: null, addressStreet: null, addressCivic: null, postalCode: null, city: null, province: null }));
    write.mockResolvedValue(profile({ canIssue: false, regime: 'VatOrdinary', legalName: 'Casa Mia Srl', vatNumber: '01234567890', missingFields: ['fiscalCode'] }));
    renderInto(createElement(OwnerIssuerProfileSection, { ownerId: OWNER_ID }));

    fireEvent.click(await screen.findByTestId('owner-issuer-edit'));
    const form = await screen.findByTestId('owner-issuer-form');
    fireEvent.click(within(form).getByTestId('owner-issuer-regime-VatOrdinary'));
    fireEvent.change(within(form).getByTestId('owner-issuer-legal-name'), { target: { value: ' Casa Mia Srl ' } });
    fireEvent.change(within(form).getByTestId('owner-issuer-vat-number'), { target: { value: '01234567890' } });
    const save = within(form).getByTestId('owner-issuer-save');
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const [ownerId, request] = write.mock.calls[0];
    expect(ownerId).toBe(OWNER_ID);
    expect(request).toMatchObject({ regime: 'VatOrdinary', legalName: 'Casa Mia Srl', vatNumber: '01234567890', countryCode: 'IT', stayVatTreatment: 'Standard' });
    expect(request.fiscalCode).toBeUndefined();
  });

  it('OwnerIssuerProfile_WhenTheProfileIsReadAgainWhileThePersonTypes_NeverThrowsAwayWhatWasTyped', async () => {
    read.mockResolvedValue(NO_PROFILE());
    const { client } = renderInto(createElement(OwnerIssuerProfileSection, { ownerId: OWNER_ID }));

    fireEvent.click(await screen.findByTestId('owner-issuer-edit'));
    const form = await screen.findByTestId('owner-issuer-form');
    fireEvent.change(within(form).getByTestId('owner-issuer-legal-name'), { target: { value: 'Casa Mia Srl' } });
    fireEvent.change(within(form).getByTestId('owner-issuer-city'), { target: { value: 'Como' } });
    read.mockResolvedValue({ ...NO_PROFILE(), exists: true, missingFields: ['regime'] });
    await readAgain(client);

    await waitFor(() => expect(screen.getByTestId('owner-issuer-state')).toHaveAttribute('data-state', 'incomplete'));
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('owner-issuer-legal-name')).toHaveValue('Casa Mia Srl');
    expect(screen.getByTestId('owner-issuer-city')).toHaveValue('Como');
    expect(write).not.toHaveBeenCalled();
  });

  it('OwnerIssuerProfile_WhenAnotherPersonChangesIt_KeepsWhatWasTypedAndFollowsTheServerForTheRest', async () => {
    read.mockResolvedValue(NO_PROFILE());
    const { client } = renderInto(createElement(OwnerIssuerProfileSection, { ownerId: OWNER_ID }));
    fireEvent.click(await screen.findByTestId('owner-issuer-edit'));
    const form = await screen.findByTestId('owner-issuer-form');

    read.mockResolvedValue({ ...NO_PROFILE(), city: 'Como' });
    await readAgain(client);
    await waitFor(() => expect(screen.getByTestId('owner-issuer-city')).toHaveValue('Como'));

    fireEvent.change(within(form).getByTestId('owner-issuer-legal-name'), { target: { value: 'Casa Mia Srl' } });
    read.mockResolvedValue({ ...NO_PROFILE(), city: 'Lecco', addressStreet: 'Via Roma' });
    await readAgain(client);

    await waitFor(() => expect(screen.getByTestId('owner-issuer-city')).toHaveValue('Lecco'));
    expect(screen.getByTestId('owner-issuer-street')).toHaveValue('Via Roma');
    expect(screen.getByTestId('owner-issuer-legal-name')).toHaveValue('Casa Mia Srl');
  });

  it('OwnerIssuerProfile_AfterASave_ShowsWhatTheServerHoldsNow', async () => {
    read.mockResolvedValue(NO_PROFILE());
    write.mockResolvedValue(profile({ canIssue: false, regime: 'VatOrdinary', legalName: 'Casa Mia Srl', vatNumber: '01234567890', city: null, missingFields: ['fiscalCode'] }));
    renderInto(createElement(OwnerIssuerProfileSection, { ownerId: OWNER_ID }));

    fireEvent.click(await screen.findByTestId('owner-issuer-edit'));
    const form = await screen.findByTestId('owner-issuer-form');
    fireEvent.click(within(form).getByTestId('owner-issuer-regime-VatOrdinary'));
    fireEvent.change(within(form).getByTestId('owner-issuer-legal-name'), { target: { value: '  Casa Mia Srl  ' } });
    fireEvent.change(within(form).getByTestId('owner-issuer-vat-number'), { target: { value: '01234567890' } });
    const save = within(form).getByTestId('owner-issuer-save');
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('owner-issuer-form')).toBeNull());
    expect(screen.getByTestId('owner-issuer-fact-legalName')).toHaveTextContent('Casa Mia Srl');
    fireEvent.click(screen.getByTestId('owner-issuer-edit'));
    await screen.findByTestId('owner-issuer-form');
    await waitFor(() => expect(screen.getByTestId('owner-issuer-save')).toBeDisabled());
  });

  it('OwnerIssuersStep_ARowThatTheServerMasks_HasNoButtonThatWrites_AndOneThatMayChangeItHasThem', async () => {
    read.mockImplementation(async (ownerId: string) => (ownerId === OWNER_ID ? MASKED : profile({ ownerId: OTHER_ID, exists: false, canIssue: false, regime: null, legalName: null, fiscalCode: null, missingFields: ['regime'] })));
    renderInto(createElement(OwnerIssuersStep, { missing: 2 }));

    const rows = await screen.findAllByTestId('billing-owner-issuer-row');
    expect(rows).toHaveLength(2);
    const masked = rows.find((row) => row.getAttribute('data-owner') === OWNER_ID)!;
    const open = rows.find((row) => row.getAttribute('data-owner') === OTHER_ID)!;
    await waitFor(() => expect(within(masked).getByTestId('billing-owner-issuer-state')).toBeInTheDocument());
    expect(within(masked).queryByTestId('billing-owner-issuer-create')).toBeNull();
    expect(within(masked).queryByTestId('billing-owner-issuer-open')).toBeNull();
    expect(await within(open).findByTestId('billing-owner-issuer-create')).toBeInTheDocument();
    expect(within(open).getByTestId('billing-owner-issuer-open')).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
  });

  it('OwnerIssuersStep_TheQuickCreation_NeverSavesAProfileMadeOfMaskedData', async () => {
    read.mockResolvedValue(profile({ ownerId: OWNER_ID, exists: false, canIssue: false, regime: null, legalName: null, fiscalCode: null, missingFields: ['regime'] }));
    vi.mocked(ownerAccountingApi.listFiscalProfiles).mockResolvedValue([
      { id: 'p1', propertyOwnerId: OWNER_ID, validFrom: '2020-01-01', validTo: null, entityKind: 'NaturalPerson', legalName: '••••ssi', taxResidenceCountry: 'IT', legalAddress: null, fiscalCode: '••••205X', vatNumber: null, foreignTaxId: null, settlementCurrency: 'EUR', bankAccountReference: null, mandateRole: null, mandateFrom: null, mandateTo: null, revenueRecognitionRule: null, expenseCommissionModel: null, workingCapitalRule: null, taxJurisdiction: null, accountingPolicyId: null, masked: true },
    ]);
    vi.mocked(ownerAccountingApi.getAddress).mockResolvedValue(null);
    renderInto(createElement(OwnerIssuersStep, { missing: 1 }));

    const create = (await screen.findAllByTestId('billing-owner-issuer-create'))[0];
    fireEvent.click(create);

    expect(await screen.findAllByTestId('billing-owner-issuer-problem')).not.toHaveLength(0);
    expect(write).not.toHaveBeenCalled();
  });

  it('OwnerIssuersStep_WhenTheProfileOfARowIsNotFoundAnyMore_NothingOfTheOldAnswerIsDrawnOrOffered', async () => {
    owners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
    read.mockResolvedValue(profile({ exists: true, canIssue: false, regime: null, missingFields: ['regime'] }));
    const { client } = renderInto(createElement(OwnerIssuersStep, { missing: 1 }));

    const row = await screen.findByTestId('billing-owner-issuer-row');
    expect(await within(row).findByTestId('billing-owner-issuer-open')).toBeInTheDocument();
    expect(within(row).getByTestId('billing-owner-issuer-missing-fields')).toBeInTheDocument();

    read.mockRejectedValue(httpFailure(404));
    await readAgain(client);

    expect(await within(row).findByTestId('billing-owner-issuer-gone')).toBeInTheDocument();
    expect(within(row).queryByTestId('billing-owner-issuer-open')).toBeNull();
    expect(within(row).queryByTestId('billing-owner-issuer-create')).toBeNull();
    expect(within(row).queryByTestId('billing-owner-issuer-missing-fields')).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('OwnerIssuersStep_WhenAReadFailsWhileTheFormIsOpen_TheFormStaysUnderThePersonsHandsAndTheRowSaysItCouldNotBeRead', async () => {
    owners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
    read.mockResolvedValue(NO_PROFILE());
    const { client } = renderInto(createElement(OwnerIssuersStep, { missing: 1 }));

    fireEvent.click(await screen.findByTestId('billing-owner-issuer-open'));
    const dialog = await screen.findByTestId('billing-owner-issuer-dialog');
    fireEvent.change(within(dialog).getByTestId('owner-issuer-legal-name'), { target: { value: 'Casa Mia Srl' } });

    read.mockRejectedValue(httpFailure(500));
    await readAgain(client);

    expect(await screen.findByTestId('billing-owner-issuer-error')).toBeInTheDocument();
    expect(within(screen.getByTestId('billing-owner-issuer-dialog')).getByTestId('owner-issuer-legal-name')).toHaveValue('Casa Mia Srl');
  });
});
