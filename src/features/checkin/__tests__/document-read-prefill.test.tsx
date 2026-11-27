import { createElement, type ComponentProps } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { APP_RESOURCES } from '@/i18n/resources';
import guestDe from '@/i18n/locales/guest-checkin.de.json';
import guestEs from '@/i18n/locales/guest-checkin.es.json';
import guestFr from '@/i18n/locales/guest-checkin.fr.json';
import { publicCheckinApi } from '@/api/checkin.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { CheckInDocumentReadResult, PublicCheckInContextDto, PublicCheckInGuestPrefill } from '@/types/public-checkin.types';
import { CheckInPage } from '../checkin-page';
import { DocumentReadStep } from '../components/document-read-step';
import { buildPrefill, PREFILL_ROWS, prefillFieldKey, withConfirmedValues, zonedAnswerOf, type DocumentPrefill } from '../lib/document-prefill';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: { getContext: vi.fn(), requestInvoice: vi.fn(), readDocument: vi.fn(), submit: vi.fn(), searchCodes: vi.fn(), setLanguage: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

configure({ asyncUtilTimeout: 15_000 });

const TOKEN = 'tok-prefill';

const READ_VALUES = ['CA12345AB', '1990-05-15', 'Roma', '2022-03-11', '2032-03-11'];

const booker: PublicCheckInGuestPrefill = {
  type: 'SingleGuest',
  firstName: 'Mario',
  lastName: 'Rossi',
  gender: null,
  dateOfBirth: null,
  bornInItaly: null,
  birthComuneName: '',
  birthCountryName: '',
  citizenshipName: '',
  documentNumberMasked: null,
  documentIssuePlaceName: '',
};

const openContext: PublicCheckInContextDto = {
  completed: false,
  status: 'InCompilazione',
  sessionId: '11111111-1111-1111-1111-111111111111',
  propertyName: 'Villa Demo',
  checkInDate: '2026-10-10T00:00:00Z',
  checkOutDate: '2026-10-12T00:00:00Z',
  declaredGuests: 1,
  guests: [booker],
  availableCodeTables: [],
};

function zonedAnswer(overrides: Partial<CheckInDocumentReadResult> = {}): CheckInDocumentReadResult {
  return {
    read: true,
    side: 'front',
    guestPosition: 0,
    confirmGuest: false,
    guest: {
      firstName: 'Mario',
      lastName: 'Rossi',
      gender: 'Male',
      dateOfBirth: '1990-05-15',
      bornInItaly: true,
      birthPlace: 'Roma',
      birthProvince: 'RM',
      citizenship: 'Italia',
      documentKind: 'IdentityCard',
      documentNumber: 'CA12345AB',
      issuePlace: null,
      documentIssuedOn: '2022-03-11',
      documentExpiresOn: '2032-03-11',
    },
    fields: [
      { name: 'surname', value: 'ROSSI', side: 'front', zone: 'surname', confidence: 0.55, source: 'viz' },
      { name: 'givenNames', value: 'MARIO', side: 'front', zone: 'givenNames', confidence: 0.55, source: 'viz' },
      { name: 'birthDate', value: '1990-05-15', side: 'front', zone: 'birthDate', confidence: 0.55, source: 'viz' },
      { name: 'documentNumber', value: 'CA12345AB', side: 'back', zone: 'mrz', confidence: 0.95, source: 'mrz' },
    ],
    missing: ['lastName', 'firstName', 'issuePlace'],
    source: 'local',
    ...overrides,
  };
}

function legacyAnswer(): CheckInDocumentReadResult {
  const { fields, missing, source, ...rest } = zonedAnswer();
  void fields;
  void missing;
  void source;
  return rest;
}

const nothingFilled = () => false;
const text = (key: string) => i18n.t(key);
const photo = () => new File(['document'], 'document.jpg', { type: 'image/jpeg' });

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

describe('document-read-prefill: the answer of the server and what the page makes of it (E71/F02/US01/T02)', () => {
  it('zonedAnswerOf_TheAnswerOfBefore_IsNothingSoTheStepIsTheOneItAlwaysWas', () => {
    expect(zonedAnswerOf(legacyAnswer())).toBeNull();
    expect(buildPrefill(legacyAnswer(), nothingFilled)).toBeNull();
  });

  it.each([
    ['a source that is not the local reading', { source: 'remote' }],
    ['no source', { source: null }],
    ['no fields', { fields: undefined }],
    ['no list of what is missing', { missing: null }],
    ['fields that are not a list', { fields: 'x' as unknown as CheckInDocumentReadResult['fields'] }],
  ])('zonedAnswerOf_%s_IsNothing', (_name, overrides) => {
    expect(zonedAnswerOf(zonedAnswer(overrides as Partial<CheckInDocumentReadResult>))).toBeNull();
  });

  it('zonedAnswerOf_TheLocalReading_KeepsTheFieldsThatHaveAValueAndTheNamesThatAreTexts', () => {
    const answer = zonedAnswer({
      fields: [
        { name: 'surname', value: 'ROSSI', side: 'front', zone: 'surname', confidence: 0.55, source: 'viz' },
        { name: 'sex', value: '  ', side: 'front', zone: 'sex', confidence: 0.55, source: 'viz' },
        null as unknown as NonNullable<CheckInDocumentReadResult['fields']>[number],
      ],
      missing: ['gender', '', 3 as unknown as string],
    });

    expect(zonedAnswerOf(answer)).toEqual({
      fields: [{ name: 'surname', value: 'ROSSI', side: 'front', zone: 'surname', confidence: 0.55, source: 'viz' }],
      missing: ['gender'],
    });
  });

  it('buildPrefill_TheLocalReading_ShowsTheValuesItGaveWithWhereEachWasReadAndAsksOnlyWhatIsMissing', () => {
    const prefill = buildPrefill(zonedAnswer(), nothingFilled);

    expect(prefill?.rows).toEqual([
      { name: 'gender', value: 'Male', source: null },
      { name: 'dateOfBirth', value: '1990-05-15', source: 'viz' },
      { name: 'birthPlace', value: 'Roma', source: null },
      { name: 'citizenship', value: 'Italia', source: null },
      { name: 'documentKind', value: 'IdentityCard', source: null },
      { name: 'documentNumber', value: 'CA12345AB', source: 'mrz' },
      { name: 'documentIssuedOn', value: '2022-03-11', source: null },
      { name: 'documentExpiresOn', value: '2032-03-11', source: null },
    ]);
    expect(prefill?.missing).toEqual(['lastName', 'firstName', 'issuePlace']);
    expect(prefill?.missing.some((name) => prefill.rows.some((row) => row.name === name))).toBe(false);
  });

  it('buildPrefill_TheFormAlreadyHoldsADatum_IsNotAskedEvenThoughThisPhotoDidNotGiveIt', () => {
    const filled = new Set(['lastName', 'firstName']);
    const prefill = buildPrefill(zonedAnswer(), (name) => filled.has(name));

    expect(prefill?.missing).toEqual(['issuePlace']);
  });

  it('buildPrefill_AValueOnlyTheZonesGave_IsShownAsReadAndNotAsked', () => {
    const prefill = buildPrefill(
      zonedAnswer({
        guest: { gender: 'Female', bornInItaly: false, birthPlace: 'Francia' },
        fields: [
          { name: 'documentNumber', value: 'YA7654321', side: 'back', zone: 'mrz', confidence: 0.95, source: 'mrz' },
          { name: 'expiryDate', value: '2031-01-31T00:00:00Z', side: 'back', zone: 'mrz', confidence: 0.95, source: 'mrz' },
        ],
        missing: ['dateOfBirth'],
      }),
      nothingFilled,
    );

    expect(prefill?.rows.find((row) => row.name === 'documentNumber')).toEqual({ name: 'documentNumber', value: 'YA7654321', source: 'mrz' });
    expect(prefill?.rows.find((row) => row.name === 'documentExpiresOn')).toEqual({ name: 'documentExpiresOn', value: '2031-01-31', source: 'mrz' });
    expect(prefill?.rows.find((row) => row.name === 'birthPlace')?.value).toBe('Francia');
    expect(prefill?.missing).toEqual(['dateOfBirth']);
  });

  it('buildPrefill_AValueTheFormCannotTake_IsAskedLikeOneThatWasNotRead', () => {
    const prefill = buildPrefill(
      zonedAnswer({
        guest: { birthPlace: 'Roma', gender: 'Other' },
        fields: [
          { name: 'sex', value: 'X', side: 'front', zone: 'sex', confidence: 0.95, source: 'mrz' },
          { name: 'birthPlace', value: 'ROMA', side: 'front', zone: 'birthPlace', confidence: 0.55, source: 'viz' },
        ],
        missing: [],
      }),
      nothingFilled,
    );

    expect(prefill?.rows.map((row) => row.name)).not.toContain('birthPlace');
    expect(prefill?.rows.map((row) => row.name)).not.toContain('gender');
    expect(prefill?.missing).toEqual(expect.arrayContaining(['gender', 'birthPlace']));
  });

  it('buildPrefill_ANameThePageDoesNotKnow_IsAskedUnderTheGeneralLabel', () => {
    const prefill = buildPrefill(zonedAnswer({ missing: ['a_field_of_the_future'] }), nothingFilled);

    expect(prefill?.missing).toContain('a_field_of_the_future');
    expect(prefillFieldKey('a_field_of_the_future')).toBe('checkin.prefill.field.other');
    expect(prefillFieldKey('birthPlace')).toBe('checkin.prefill.field.birthPlace');
  });

  it('buildPrefill_AnAnswerWithNothingRead_HasNoRowsAndAsksWhatTheServerSays', () => {
    const prefill = buildPrefill(zonedAnswer({ guest: {}, fields: [], missing: ['gender', 'dateOfBirth'] }), nothingFilled);

    expect(prefill).toEqual({ rows: [], missing: ['gender', 'dateOfBirth'] });
  });

  it('withConfirmedValues_WhatTheGuestLeft_ReplacesWhatWasReadAndTheRestOfTheAnswerIsUntouched', () => {
    const answer = zonedAnswer();
    const confirmed = withConfirmedValues(answer, { dateOfBirth: '1991-06-16', documentNumber: ' CA99999ZZ ', gender: '' });

    expect(confirmed.guest?.dateOfBirth).toBe('1991-06-16');
    expect(confirmed.guest?.documentNumber).toBe('CA99999ZZ');
    expect(confirmed.guest?.gender).toBeNull();
    expect(confirmed.guest?.citizenship).toBe('Italia');
    expect(confirmed.guestPosition).toBe(0);
    expect(confirmed.side).toBe('front');
    expect(answer.guest?.dateOfBirth).toBe('1990-05-15');
  });

  it('PREFILL_ROWS_TheNames_AreNotAmongTheValuesTheGuestChecksBecauseTheyComeFromTheBooking', () => {
    expect([...PREFILL_ROWS]).not.toContain('firstName');
    expect([...PREFILL_ROWS]).not.toContain('lastName');
  });

  it('prefillFieldKey_EveryRowAndEveryNameOfTheContract_HasItsWordsInTheFiveGuestLanguages', () => {
    const names = [...PREFILL_ROWS, 'lastName', 'firstName', 'a_field_of_the_future'];
    const keys = names.map(prefillFieldKey);
    const bundles = {
      it: APP_RESOURCES.it.translation as unknown as Record<string, unknown>,
      en: APP_RESOURCES.en.translation as unknown as Record<string, unknown>,
      de: guestDe as unknown as Record<string, unknown>,
      fr: guestFr as unknown as Record<string, unknown>,
      es: guestEs as unknown as Record<string, unknown>,
    };
    const read = (bundle: Record<string, unknown>, key: string): unknown => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
    const prefillKeys = ['title', 'intro', 'readFromDocument', 'checkIt', 'confirm', 'discard', 'missingTitle', 'missingText', 'complete'].map((name) => `checkin.prefill.${name}`);

    for (const [language, bundle] of Object.entries(bundles)) {
      const missing = [...keys, ...prefillKeys].filter((key) => typeof read(bundle, key) !== 'string' || (read(bundle, key) as string).trim() === '');
      expect(missing, `${language}: prefill without words`).toEqual([]);
    }
  });
});

describe('document-read-prefill: the data step shows what was read (AC4)', () => {
  const prefill = (): DocumentPrefill => buildPrefill(zonedAnswer(), nothingFilled)!;

  function renderStep(overrides: Partial<ComponentProps<typeof DocumentReadStep>> = {}) {
    const props = {
      reading: false,
      review: null,
      onConfirm: vi.fn(),
      message: null,
      readCount: 1,
      onFile: vi.fn(),
      onManual: vi.fn(),
      onContinue: vi.fn(),
      prefill: prefill(),
      onConfirmPrefill: vi.fn(),
      onDiscardPrefill: vi.fn(),
      ...overrides,
    };
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const view = render(
      <form onSubmit={onSubmit}>
        <DocumentReadStep {...props} />
      </form>,
    );
    return { ...view, props, onSubmit };
  }

  it('DocumentReadStep_AReading_MarksEveryValueReadFromTheDocumentAndKeepsItEditable', () => {
    renderStep();

    const panel = screen.getByTestId('checkin-prefill');
    for (const row of prefill().rows) {
      const marker = within(panel).getByTestId(`checkin-prefill-marker-${row.name}`);
      expect(marker).toHaveTextContent(text('checkin.prefill.readFromDocument'));
      const control = within(panel).getByTestId(`checkin-prefill-value-${row.name}`);
      expect(control).toBeEnabled();
      expect(control).not.toHaveAttribute('readonly');
      expect(control).toHaveValue(row.value);
      expect(within(panel).getByLabelText(text(prefillFieldKey(row.name)))).toBe(control);
      expect(control).toHaveAccessibleDescription(expect.stringContaining(text('checkin.prefill.readFromDocument')));
    }
    expect(within(panel).getByTestId('checkin-prefill-value-dateOfBirth')).toHaveAttribute('type', 'date');
    expect(within(panel).getByTestId('checkin-prefill-value-documentNumber')).toHaveAttribute('type', 'text');
    expect(within(panel).getByTestId('checkin-prefill-value-gender').tagName).toBe('SELECT');
  });

  it('DocumentReadStep_AValueReadFromThePrintedText_AsksTheGuestToCheckItAndOneReadFromTheLinesOfLettersDoesNot', () => {
    renderStep();

    expect(screen.getByTestId('checkin-prefill-value-dateOfBirth')).toHaveAccessibleDescription(expect.stringContaining(text('checkin.prefill.checkIt')));
    expect(screen.getByTestId('checkin-prefill-value-documentNumber')).not.toHaveAccessibleDescription(expect.stringContaining(text('checkin.prefill.checkIt')));
  });

  it('DocumentReadStep_AReading_AsksOnlyForWhatWasNotRead', () => {
    renderStep();

    const asked = screen.getByTestId('checkin-prefill-missing');
    const items = within(asked).getAllByTestId('checkin-prefill-missing-item');
    expect(items.map((item) => item.textContent)).toEqual([text('checkin.prefill.field.lastName'), text('checkin.prefill.field.firstName'), text('checkin.prefill.field.issuePlace')]);
    expect(asked).not.toHaveTextContent(text('checkin.prefill.field.dateOfBirth'));
    expect(asked).not.toHaveTextContent(text('checkin.prefill.field.documentNumber'));
    expect(asked).toHaveTextContent(text('checkin.prefill.missingText'));
  });

  it('DocumentReadStep_NamesTheServerDoesNotKnowAreOneLineAndNotMany', () => {
    renderStep({ prefill: { rows: [], missing: ['a', 'b', 'c'] } });

    expect(screen.getAllByTestId('checkin-prefill-missing-item')).toHaveLength(1);
    expect(screen.getByTestId('checkin-prefill-missing-item')).toHaveTextContent(text('checkin.prefill.field.other'));
  });

  it('DocumentReadStep_NothingIsMissing_SaysThereIsNothingMoreToTypeFromThisDocument', () => {
    renderStep({ prefill: { rows: prefill().rows, missing: [] } });

    expect(screen.queryByTestId('checkin-prefill-missing')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-prefill-complete')).toHaveTextContent(text('checkin.prefill.complete'));
  });

  it('DocumentReadStep_TheGuestChangesAValueAndConfirms_TheValuesTheyLeftAreHandedOn', () => {
    const view = renderStep();

    fireEvent.change(screen.getByTestId('checkin-prefill-value-dateOfBirth'), { target: { value: '1991-06-16' } });
    fireEvent.change(screen.getByTestId('checkin-prefill-value-documentNumber'), { target: { value: 'CA00000ZZ' } });
    fireEvent.change(screen.getByTestId('checkin-prefill-value-gender'), { target: { value: 'Female' } });
    fireEvent.click(screen.getByTestId('checkin-prefill-confirm'));

    expect(view.props.onConfirmPrefill).toHaveBeenCalledTimes(1);
    expect(view.props.onConfirmPrefill).toHaveBeenCalledWith(
      expect.objectContaining({ dateOfBirth: '1991-06-16', documentNumber: 'CA00000ZZ', gender: 'Female', birthPlace: 'Roma', documentKind: 'IdentityCard' }),
    );
  });

  it('DocumentReadStep_TheGuestDropsTheReading_TheDropIsReported', () => {
    const view = renderStep();

    fireEvent.click(screen.getByTestId('checkin-prefill-discard'));

    expect(view.props.onDiscardPrefill).toHaveBeenCalledTimes(1);
    expect(view.props.onConfirmPrefill).not.toHaveBeenCalled();
  });

  it('DocumentReadStep_EnterInAValue_DoesNotSendTheFormAroundItAndConfirmsNothing', () => {
    const view = renderStep();

    const input = screen.getByTestId('checkin-prefill-value-documentNumber');
    const allowed = fireEvent.keyDown(input, { key: 'Enter' });

    expect(allowed).toBe(false);
    expect(view.props.onConfirmPrefill).not.toHaveBeenCalled();
  });

  it('DocumentReadStep_AReadingToCheck_HoldsBackTheWayOnUntilTheGuestConfirmsOrDropsIt', () => {
    renderStep();

    expect(screen.getByTestId('checkin-scan-continue')).toBeDisabled();
    expect(screen.getByTestId('checkin-enter-manually')).toBeEnabled();
  });

  it('DocumentReadStep_APageThatIsWorking_DisablesTheConfirmationAndTheDrop', () => {
    renderStep({ reading: true });

    expect(screen.getByTestId('checkin-prefill-confirm')).toBeDisabled();
    expect(screen.getByTestId('checkin-prefill-discard')).toBeDisabled();
  });

  it('DocumentReadStep_WithoutAReading_IsTheStepItAlwaysWasWithNoPanel', () => {
    renderStep({ prefill: null });

    expect(screen.queryByTestId('checkin-prefill')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-scan-continue')).toBeEnabled();
  });

  it('DocumentReadStep_AReadingToCheck_HasNoAccessibilityViolations', async () => {
    const { container } = renderStep();

    await expectNoAxeViolations(container);
  });

  it('DocumentReadStep_TheValuesAreInThePanelAndNowhereElse_NothingIsWrittenToAnyStorage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderStep();
    fireEvent.change(screen.getByTestId('checkin-prefill-value-documentNumber'), { target: { value: 'CA00000ZZ' } });
    fireEvent.click(screen.getByTestId('checkin-prefill-confirm'));

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    setItem.mockRestore();
  });
});

describe('document-read-prefill: on the page of the guest (AC4, privacy)', () => {
  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [`/checkin/${TOKEN}`] },
          createElement(Routes, null, createElement(Route, { path: '/checkin/:token', element: createElement(CheckInPage) })),
        ),
      ),
    );
  }

  const chooseDocument = () => fireEvent.change(screen.getByTestId('checkin-document-file'), { target: { files: [photo()] } });
  const guestCard = () => within(screen.getByTestId('stay-guest-0'));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(openContext);
    vi.mocked(publicCheckinApi.searchCodes).mockResolvedValue([]);
    vi.mocked(publicCheckinApi.readDocument).mockResolvedValue(zonedAnswer());
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
    document.documentElement.lang = 'it';
    localStorage.clear();
    sessionStorage.clear();
  });

  it('document-read-prefill: no storage write', { timeout: 30_000 }, async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const consoleCalls = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug')];
    renderPage();
    await screen.findByTestId('checkin-page');

    chooseDocument();
    const panel = await screen.findByTestId('checkin-prefill');
    fireEvent.change(within(panel).getByTestId('checkin-prefill-value-documentNumber'), { target: { value: 'CA99999ZZ' } });
    fireEvent.click(within(panel).getByTestId('checkin-prefill-confirm'));
    await waitFor(() => expect(screen.queryByTestId('checkin-prefill')).not.toBeInTheDocument());
    await screen.findByTestId('checkin-document-message');
    fireEvent.click(screen.getByTestId('checkin-scan-continue'));
    await screen.findByTestId('stay-guest-0');

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    for (const value of [...READ_VALUES, 'CA99999ZZ']) {
      expect(window.location.href).not.toContain(value);
      expect(`${window.location.search}${window.location.hash}`).not.toContain(value);
    }
    for (const call of consoleCalls) expect(call).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('CheckInPage_ALocalReading_ShowsTheValuesMarkedAndEditableAsksOnlyWhatIsMissingAndPutsTheConfirmedValuesInTheForm', { timeout: 30_000 }, async () => {
    renderPage();
    await screen.findByTestId('checkin-page');

    chooseDocument();
    const panel = await screen.findByTestId('checkin-prefill');

    expect(publicCheckinApi.readDocument).toHaveBeenCalledTimes(1);
    expect(within(panel).getByTestId('checkin-prefill-marker-documentNumber')).toHaveTextContent('Letto dal documento');
    expect(within(panel).getByTestId('checkin-prefill-value-dateOfBirth')).toHaveValue('1990-05-15');
    const asked = within(panel).getAllByTestId('checkin-prefill-missing-item');
    expect(asked.map((item) => item.textContent)).toEqual(['Luogo di rilascio']);
    expect(screen.queryByTestId('checkin-scan-continue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-document-message')).not.toBeInTheDocument();

    fireEvent.change(within(panel).getByTestId('checkin-prefill-value-dateOfBirth'), { target: { value: '1991-06-16' } });
    fireEvent.click(within(panel).getByTestId('checkin-prefill-confirm'));

    expect(await screen.findByTestId('checkin-document-message')).toHaveTextContent('Dati letti per Mario Rossi');
    expect(screen.queryByTestId('checkin-prefill')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('checkin-scan-continue'));

    await screen.findByTestId('stay-guest-0');
    await waitFor(() => expect(guestCard().getByLabelText(/^Data di nascita/)).toHaveValue('1991-06-16'));
    expect(guestCard().getByLabelText(/^Sesso/)).toHaveValue('Male');
    expect((guestCard().getByLabelText(/^Cittadinanza/) as HTMLInputElement).value).toMatch(/^Ital/);
  });

  it('CheckInPage_TheGuestDropsTheReading_NothingGoesIntoTheFormAndThePanelIsGone', { timeout: 30_000 }, async () => {
    renderPage();
    await screen.findByTestId('checkin-page');
    chooseDocument();
    await screen.findByTestId('checkin-prefill');

    fireEvent.click(screen.getByTestId('checkin-prefill-discard'));

    expect(screen.queryByTestId('checkin-prefill')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-document-message')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-scan-continue')).not.toBeInTheDocument();
  });

  it('CheckInPage_TheGuestTypesTheDataByHandInstead_TheReadingIsLeftBehindWithItsValues', { timeout: 30_000 }, async () => {
    renderPage();
    await screen.findByTestId('checkin-page');
    chooseDocument();
    await screen.findByTestId('checkin-prefill');

    fireEvent.click(screen.getByTestId('checkin-enter-manually'));

    await screen.findByTestId('stay-guest-0');
    expect(guestCard().getByLabelText(/^Data di nascita/)).toHaveValue('');
    expect(screen.queryByTestId('checkin-prefill')).not.toBeInTheDocument();
  });

  it('CheckInPage_ASecondPhotoOfTheCard_AsksOnlyWhatIsStillMissingAfterTheFirst', { timeout: 30_000 }, async () => {
    renderPage();
    await screen.findByTestId('checkin-page');
    chooseDocument();
    const first = await screen.findByTestId('checkin-prefill');
    fireEvent.click(within(first).getByTestId('checkin-prefill-confirm'));
    await screen.findByTestId('checkin-document-message');

    vi.mocked(publicCheckinApi.readDocument).mockResolvedValue(
      zonedAnswer({ side: 'back', guest: { issuePlace: 'Roma' }, fields: [], missing: ['dateOfBirth', 'gender', 'issuePlace'] }),
    );
    chooseDocument();
    const second = await screen.findByTestId('checkin-prefill');

    expect(within(second).queryAllByTestId('checkin-prefill-missing-item')).toHaveLength(0);
    expect(within(second).getByTestId('checkin-prefill-complete')).toBeInTheDocument();
    expect(within(second).getByTestId('checkin-prefill-value-issuePlace')).toHaveValue('Roma');
  });

  it('CheckInPage_TheServerAnswersAsBefore_TheValuesGoStraightIntoTheFormWithNoPanel', { timeout: 30_000 }, async () => {
    vi.mocked(publicCheckinApi.readDocument).mockResolvedValue(legacyAnswer());
    renderPage();
    await screen.findByTestId('checkin-page');

    chooseDocument();

    expect(await screen.findByTestId('checkin-document-message')).toHaveTextContent('Dati letti per Mario Rossi');
    expect(screen.queryByTestId('checkin-prefill')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-scan-continue')).toBeEnabled();
    fireEvent.click(screen.getByTestId('checkin-scan-continue'));
    await screen.findByTestId('stay-guest-0');
    await waitFor(() => expect(guestCard().getByLabelText(/^Data di nascita/)).toHaveValue('1990-05-15'));
  });

  it('CheckInPage_TheReadingNeedsTheGuestToConfirmTheName_ShowsTheValuesAfterTheConfirmation', { timeout: 30_000 }, async () => {
    vi.mocked(publicCheckinApi.readDocument).mockResolvedValue(zonedAnswer({ confirmGuest: true, guest: { ...zonedAnswer().guest, firstName: 'Mario', lastName: 'Rossy' } }));
    renderPage();
    await screen.findByTestId('checkin-page');

    chooseDocument();
    await screen.findByRole('button', { name: 'Confermo il nominativo della prenotazione' });
    expect(screen.queryByTestId('checkin-prefill')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confermo il nominativo della prenotazione' }));

    expect(await screen.findByTestId('checkin-prefill')).toBeInTheDocument();
  });
});
