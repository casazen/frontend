import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError } from 'axios';
import { assistantSettingsApi } from '@/api/assistant-settings.api';
import { propertiesApi } from '@/api/properties.api';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import type { Property } from '@/types';
import type {
  AssistantKnowledgeView,
  AssistantRules,
  EffectiveSituation,
  KnowledgeEntry,
  PropertyAssistantSettings,
} from '@/types/assistant-settings.types';
import { AssistantSettingsPage } from '../assistant-settings-page';

const grants = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock('@/api/assistant-settings.api', () => ({
  assistantSettingsApi: {
    getRules: vi.fn(),
    saveRules: vi.fn(),
    getPropertySettings: vi.fn(),
    savePropertySettings: vi.fn(),
    deletePropertySettings: vi.fn(),
    getKnowledge: vi.fn(),
    createPropertyEntry: vi.fn(),
    updatePropertyEntry: vi.fn(),
    deletePropertyEntry: vi.fn(),
    listOrganizationEntries: vi.fn(),
    createOrganizationEntry: vi.fn(),
    updateOrganizationEntry: vi.fn(),
    deleteOrganizationEntry: vi.fn(),
    getSituations: vi.fn(),
    saveSituation: vi.fn(),
    getPropertySituations: vi.fn(),
    savePropertySituation: vi.fn(),
    deletePropertySituation: vi.fn(),
  },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => grants.permissions.has(permission) }) }));
vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const ADMIN = ['booking.read', 'property.read', 'property.write', 'org.billing.admin'];

const RULES: AssistantRules = {
  enabled: true,
  tone: 'Friendly',
  languages: ['it', 'en'],
  signature: 'Sofia',
  hoursFrom: '09:00:00',
  hoursTo: '21:00:00',
  allowedTopics: [],
  forbiddenTopics: ['Parking'],
  confidenceThreshold: 0.8,
  instructionVersion: 3,
};

const NO_EXCEPTIONS: PropertyAssistantSettings = {
  propertyId: 'p1',
  enabled: null,
  tone: null,
  signature: null,
  hoursFrom: null,
  hoursTo: null,
  confidenceThreshold: null,
  forbiddenTopics: null,
  updatedAt: null,
};

function entry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'e1',
    propertyId: 'p1',
    topic: 'WiFi',
    kind: 'Faq',
    source: 'Custom',
    title: 'Qual è la password del Wi-Fi?',
    text: 'È sul frigorifero: tramonto2026.',
    language: null,
    lessonId: null,
    isActive: true,
    inherited: false,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

const KNOWLEDGE: AssistantKnowledgeView = {
  propertyId: 'p1',
  language: 'it',
  facts: [{ topic: 'CheckIn', text: 'Dalle 15:00 alle 20:00.', sourceField: 'checkInFrom' }],
  entries: [entry(), entry({ id: 'e2', propertyId: null, inherited: true, title: null, kind: 'Fact', topic: 'Pets', text: 'Cani piccoli ammessi.' })],
  topicsWithoutData: ['Parking'],
};

function situation(overrides: Partial<EffectiveSituation> & { code: string }): EffectiveSituation {
  return {
    situation: overrides.code,
    mode: 'Draft',
    allowedModes: ['Escalate', 'Draft', 'Automatic', 'AutomaticWithExceptions'],
    sensitiveCategories: 'None',
    isSensitive: false,
    hasTemplate: false,
    template: null,
    source: null,
    modeSince: null,
    origin: 'default',
    ...overrides,
  };
}

const SITUATIONS: EffectiveSituation[] = [
  situation({ code: 'wifi', source: 'WiFi' }),
  situation({ code: 'cancellation_or_refund', allowedModes: ['Escalate', 'Draft'], isSensitive: true, sensitiveCategories: 'CancellationRefund, Money' }),
  situation({ code: 'check_in_time', mode: 'Automatic', hasTemplate: true, template: 'Il check-in è dalle 15.', source: 'CheckIn', origin: 'organization', modeSince: '2026-10-01T00:00:00Z' }),
];

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderPage(url = '/app/short-rent/settings/assistant') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/app/short-rent/settings/assistant" element={<AssistantSettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

describe('the settings of the assistant (E05/F05/US04/T02)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    grants.permissions = new Set(ADMIN);
    vi.mocked(assistantSettingsApi.getRules).mockResolvedValue(RULES);
    vi.mocked(assistantSettingsApi.listOrganizationEntries).mockResolvedValue([]);
    vi.mocked(assistantSettingsApi.getPropertySettings).mockResolvedValue(NO_EXCEPTIONS);
    vi.mocked(assistantSettingsApi.getKnowledge).mockResolvedValue(KNOWLEDGE);
    vi.mocked(assistantSettingsApi.getSituations).mockResolvedValue(SITUATIONS);
    vi.mocked(assistantSettingsApi.getPropertySituations).mockResolvedValue(SITUATIONS);
    vi.mocked(propertiesApi.getAll).mockResolvedValue([{ id: 'p1', name: 'Casa Mare' }, { id: 'p2', name: 'Casa Monti' }] as Property[]);
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  describe('the rules of the organization', () => {
    it('rulesForm_Administrator_ReadsWhatTheServerHoldsAndSavesTheWholeSetWithTheThresholdItRead', async () => {
      vi.mocked(assistantSettingsApi.saveRules).mockResolvedValue(RULES);
      renderPage();

      expect(await screen.findByTestId('assistant-rules-form')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-enabled-switch')).toBeChecked();
      expect(screen.getByTestId('assistant-signature')).toHaveValue('Sofia');
      expect(screen.getByTestId('assistant-hours-from')).toHaveValue('09:00');

      fireEvent.change(screen.getByTestId('assistant-signature'), { target: { value: 'Sofia e Luca' } });
      fireEvent.click(screen.getByTestId('assistant-rules-save'));

      // The whole set goes back, the hours as the server writes them and the threshold the screen does not show, as it was read: a save never resets it.
      await waitFor(() =>
        expect(assistantSettingsApi.saveRules).toHaveBeenCalledWith({
          enabled: true,
          tone: 'Friendly',
          languages: ['it', 'en'],
          signature: 'Sofia e Luca',
          hoursFrom: '09:00:00',
          hoursTo: '21:00:00',
          allowedTopics: [],
          forbiddenTopics: ['Parking'],
          confidenceThreshold: 0.8,
        }),
      );
    });

    it('rulesForm_EmptyListOfAllowedTopics_SaysNoRestrictionNotNothingAllowed', async () => {
      renderPage();

      const allowed = await screen.findByTestId('assistant-allowed-topics');
      expect(allowed).toHaveTextContent('Nessun argomento scelto: nessuna restrizione, l’assistente può rispondere su qualsiasi argomento.');
      expect(allowed).not.toHaveTextContent('nessun argomento consentito');
    });

    it('rulesForm_AtAnyTime_SavesNoHours', async () => {
      vi.mocked(assistantSettingsApi.saveRules).mockResolvedValue(RULES);
      renderPage();

      fireEvent.click(await screen.findByTestId('assistant-any-time'));
      fireEvent.click(screen.getByTestId('assistant-rules-save'));

      await waitFor(() => expect(assistantSettingsApi.saveRules).toHaveBeenCalledWith(expect.objectContaining({ hoursFrom: null, hoursTo: null })));
    });

    it('rulesForm_NoLanguage_IsNotSentAndSaysWhy', async () => {
      renderPage();

      fireEvent.click(await screen.findByTestId('assistant-language-it'));
      fireEvent.click(screen.getByTestId('assistant-language-en'));
      fireEvent.click(screen.getByTestId('assistant-rules-save'));

      expect(await screen.findByText('Scegli almeno una lingua.')).toBeInTheDocument();
      expect(assistantSettingsApi.saveRules).not.toHaveBeenCalled();
    });

    it('rulesForm_PersonWhoIsNotTheAdministrator_ReadsTheRulesWithTheReasonAndCannotChangeThem', async () => {
      grants.permissions = new Set(['booking.read', 'property.read', 'property.write']);
      renderPage();

      expect(await screen.findByTestId('assistant-rules-read-only')).toHaveTextContent('le cambia solo l’amministratore dell’organizzazione');
      expect(screen.getByTestId('assistant-signature')).toBeDisabled();
      expect(screen.getByTestId('assistant-enabled-switch')).toBeDisabled();
      expect(screen.queryByTestId('assistant-rules-save')).not.toBeInTheDocument();
      expect(assistantSettingsApi.saveRules).not.toHaveBeenCalled();
    });

    it('rulesForm_PersonWhoCannotReadTheBookings_AsksNothingOfTheServer', async () => {
      grants.permissions = new Set(['property.read', 'property.write']);
      renderPage();

      expect(await screen.findByTestId('assistant-rules-no-access')).toBeInTheDocument();
      expect(assistantSettingsApi.getRules).not.toHaveBeenCalled();
      expect(assistantSettingsApi.listOrganizationEntries).not.toHaveBeenCalled();
    });

    it('rulesForm_RulesThatCannotBeRead_IsAFailureNeverAFormWithDefaults', async () => {
      vi.mocked(assistantSettingsApi.getRules).mockRejectedValue(httpError(403));
      renderPage();

      expect(await screen.findByTestId('assistant-rules-error')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-rules-form')).not.toBeInTheDocument();
    });

    it('rulesForm_SaveRefusedByTheServer_ShowsTheReasonInWords', async () => {
      vi.mocked(assistantSettingsApi.saveRules).mockRejectedValue(httpError(409, { code: 'assistant_concurrent_change' }));
      renderPage();

      fireEvent.change(await screen.findByTestId('assistant-signature'), { target: { value: 'Altro' } });
      fireEvent.click(screen.getByTestId('assistant-rules-save'));

      expect(await screen.findByTestId('assistant-rules-save-error')).toHaveTextContent('Qualcuno ha cambiato le istruzioni dell’assistente');
    });

    it('rulesForm_HasNoAccessibilityViolation', async () => {
      const { container } = renderPage();

      await screen.findByTestId('assistant-rules-form');
      await expectNoAxeViolations(container);
    });
  });

  describe('the tabs', () => {
    it('settingsPage_TabInTheAddress_ShowsThatTabAndAnUnknownOneIsTheFirst', async () => {
      const first = renderPage('/app/short-rent/settings/assistant?tab=situations');
      expect(await screen.findByTestId('assistant-tab-situations')).toBeInTheDocument();
      expect(assistantSettingsApi.getSituations).toHaveBeenCalled();
      first.unmount();

      renderPage('/app/short-rent/settings/assistant?tab=nonsense');
      expect(await screen.findByTestId('assistant-tab-rules')).toBeInTheDocument();
    });

    it('settingsPage_ThisReleaseOnlyDrafts_SaysSoOnTheTop', async () => {
      renderPage();

      expect(await screen.findByTestId('assistant-settings-drafts-only')).toHaveTextContent('nessun messaggio parte senza la tua approvazione');
    });
  });

  describe('the situations', () => {
    const URL = '/app/short-rent/settings/assistant?tab=situations';

    it('situationsTable_EachRow_SaysWhatItDoesAndWhereTheValueIsSet', async () => {
      renderPage(URL);

      const rows = await screen.findAllByTestId('assistant-situation');
      expect(rows).toHaveLength(3);
      const wifi = rows.find((row) => row.getAttribute('data-code') === 'wifi')!;
      expect(within(wifi).getByTestId('assistant-situation-mode')).toHaveTextContent('Prepara una bozza');
      expect(within(wifi).getByTestId('assistant-situation-answer')).toHaveTextContent('La risposta parte dai dati dell’immobile: Wi-Fi.');
      expect(within(wifi).getByTestId('assistant-situation-origin')).toHaveTextContent('Valore predefinito');
      // A situation nobody configured has no start: none is shown.
      expect(within(wifi).queryByTestId('assistant-situation-since')).not.toBeInTheDocument();
    });

    it('situationsTable_SensitiveSituation_ShowsALockAndSaysItAlwaysNeedsTheDecisionOfTheHost', async () => {
      renderPage(URL);

      const rows = await screen.findAllByTestId('assistant-situation');
      const refund = rows.find((row) => row.getAttribute('data-code') === 'cancellation_or_refund')!;
      expect(within(refund).getByTestId('assistant-situation-lock')).toBeInTheDocument();
      expect(refund).toHaveTextContent('Questa decisione spetta sempre a te.');
    });

    it('situationsTable_AutomaticModeStoredOnTheServer_IsNotShownAsIfItWorked', async () => {
      renderPage(URL);

      const rows = await screen.findAllByTestId('assistant-situation');
      const checkIn = rows.find((row) => row.getAttribute('data-code') === 'check_in_time')!;
      expect(within(checkIn).getByTestId('assistant-situation-mode')).toHaveTextContent('Non attiva in questa versione');
      expect(checkIn).toHaveTextContent('l’assistente scrive solo bozze che approvi tu');
      expect(within(checkIn).getByTestId('assistant-situation-origin')).toHaveTextContent('Impostata per l’organizzazione');
      expect(within(checkIn).getByTestId('assistant-situation-since')).toHaveTextContent('In vigore dal');
    });

    it('situationEditDialog_OffersOnlyEscalateAndDraftAndSavesTheWholeRow', async () => {
      vi.mocked(assistantSettingsApi.saveSituation).mockResolvedValue(SITUATIONS[0]);
      renderPage(URL);

      const rows = await screen.findAllByTestId('assistant-situation');
      fireEvent.click(within(rows.find((row) => row.getAttribute('data-code') === 'wifi')!).getByRole('button', { name: 'Modifica' }));

      const dialog = await screen.findByTestId('assistant-situation-dialog');
      expect(within(dialog).getByTestId('assistant-mode-Escalate')).toBeInTheDocument();
      expect(within(dialog).getByTestId('assistant-mode-Draft')).toBeInTheDocument();
      expect(within(dialog).queryByTestId('assistant-mode-Automatic')).not.toBeInTheDocument();
      expect(within(dialog).queryByTestId('assistant-mode-AutomaticWithExceptions')).not.toBeInTheDocument();

      fireEvent.click(within(dialog).getByTestId('assistant-mode-Escalate'));
      fireEvent.click(within(dialog).getByTestId('assistant-situation-save'));

      // The topic that was read goes back with the new mode: changing one field never drops the others.
      await waitFor(() => expect(assistantSettingsApi.saveSituation).toHaveBeenCalledWith('wifi', { mode: 'Escalate', template: null, source: 'WiFi' }));
    });

    it('situationEditDialog_AutomaticModeThatIsNotOffered_IsSaidAndSavingSetsADraftKeepingTheText', async () => {
      vi.mocked(assistantSettingsApi.saveSituation).mockResolvedValue(SITUATIONS[2]);
      renderPage(URL);

      const rows = await screen.findAllByTestId('assistant-situation');
      fireEvent.click(within(rows.find((row) => row.getAttribute('data-code') === 'check_in_time')!).getByRole('button', { name: 'Modifica' }));

      const dialog = await screen.findByTestId('assistant-situation-dialog');
      expect(within(dialog).getByTestId('assistant-mode-not-offered')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByTestId('assistant-situation-save'));

      await waitFor(() =>
        expect(assistantSettingsApi.saveSituation).toHaveBeenCalledWith('check_in_time', { mode: 'Draft', template: 'Il check-in è dalle 15.', source: 'CheckIn' }),
      );
    });

    it('situationsTable_PersonWhoIsNotTheAdministrator_ReadsTheOrganizationsSituationsWithoutEditing', async () => {
      grants.permissions = new Set(['booking.read', 'property.read', 'property.write']);
      renderPage(URL);

      expect(await screen.findByTestId('assistant-situations-read-only')).toHaveTextContent('le cambia solo l’amministratore dell’organizzazione');
      expect(screen.queryByRole('button', { name: 'Modifica' })).not.toBeInTheDocument();
    });

    it('situationsTable_ExceptionOfAProperty_IsMarkedAndGoesBackToTheOrganizationsValue', async () => {
      vi.mocked(assistantSettingsApi.getPropertySituations).mockResolvedValue([situation({ code: 'wifi', origin: 'property', modeSince: '2026-10-02T00:00:00Z' })]);
      vi.mocked(assistantSettingsApi.deletePropertySituation).mockResolvedValue(undefined);
      renderPage(`${URL}&propertyId=p1`);

      const row = await screen.findByTestId('assistant-situation');
      expect(within(row).getByTestId('assistant-situation-origin')).toHaveTextContent('Eccezione di questo immobile');
      expect(assistantSettingsApi.getPropertySituations).toHaveBeenCalledWith('p1');

      fireEvent.click(within(row).getByTestId('assistant-situation-use-organization'));
      await waitFor(() => expect(assistantSettingsApi.deletePropertySituation).toHaveBeenCalledWith('p1', 'wifi'));
    });

    it('situationsTable_HasNoAccessibilityViolation', async () => {
      const { container } = renderPage(URL);

      await screen.findAllByTestId('assistant-situation');
      await expectNoAxeViolations(container);
    });

    it('situationsTable_PropertyThatIsNotTheirs_IsNotFoundAndAsksNothingAboutIt', async () => {
      renderPage(`${URL}&propertyId=zzz`);

      expect(await screen.findByTestId('assistant-property-unknown')).toBeInTheDocument();
      expect(assistantSettingsApi.getPropertySituations).not.toHaveBeenCalled();
    });
  });

  describe('the properties', () => {
    const URL = '/app/short-rent/settings/assistant?tab=properties';

    it('propertiesTab_NoPropertyChosen_ListsThemAndAsksNothingAboutAnyOfThem', async () => {
      renderPage(URL);

      expect(await screen.findAllByTestId('assistant-property-link')).toHaveLength(2);
      expect(screen.getByTestId('assistant-choose-property')).toBeInTheDocument();
      expect(assistantSettingsApi.getPropertySettings).not.toHaveBeenCalled();
    });

    it('propertiesTab_PropertyThatIsNotAmongTheirs_IsNotFoundNeverAnotherOneInItsPlace', async () => {
      renderPage(`${URL}&propertyId=zzz`);

      expect(await screen.findByTestId('assistant-property-unknown')).toBeInTheDocument();
      expect(assistantSettingsApi.getPropertySettings).not.toHaveBeenCalled();
      expect(assistantSettingsApi.getKnowledge).not.toHaveBeenCalled();
    });

    it('propertyPanel_NoException_ShowsEveryFieldAsTheOrganizationAndTheKnowledgeInThreeParts', async () => {
      renderPage(`${URL}&propertyId=p1`);

      expect(await screen.findByTestId('assistant-property-form')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-property-enabled')).toHaveValue('inherit');
      expect(screen.getByTestId('assistant-property-tone')).toHaveValue('inherit');
      expect(screen.getByTestId('assistant-property-exceptions')).toHaveTextContent('Come l’organizzazione: Cordiale');
      // «From your listing», «Missing information» and «Your answers», and the note about the access codes.
      expect(await screen.findByTestId('assistant-fact')).toHaveTextContent('Dalle 15:00 alle 20:00.');
      expect(screen.getByTestId('assistant-missing')).toHaveTextContent('Parcheggio');
      expect(screen.getAllByTestId('assistant-entry')).toHaveLength(2);
      expect(screen.getByTestId('assistant-access-codes-note')).toHaveTextContent('non vengono mai letti dall’assistente');
      // Nothing to remove while the property follows the organization.
      expect(screen.queryByTestId('assistant-property-reset')).not.toBeInTheDocument();
    });

    it('propertyPanel_HasNoAccessibilityViolation', async () => {
      const { container } = renderPage(`${URL}&propertyId=p1`);

      await screen.findByTestId('assistant-fact');
      await expectNoAxeViolations(container);
    });

    it('propertyPanel_ExceptionThatLoosensTheOrganization_SaysSoAndSavesTheThresholdItRead', async () => {
      vi.mocked(assistantSettingsApi.getPropertySettings).mockResolvedValue({ ...NO_EXCEPTIONS, forbiddenTopics: [], confidenceThreshold: 0.7 });
      vi.mocked(assistantSettingsApi.savePropertySettings).mockResolvedValue(NO_EXCEPTIONS);
      renderPage(`${URL}&propertyId=p1`);

      // The organization forbids Parking; this property forbids nothing, and accepts drafts at a lower threshold: both are said, none in silence.
      expect(await screen.findByTestId('assistant-relaxed-topics')).toHaveTextContent('Parcheggio');
      expect(screen.getByTestId('assistant-relaxed-threshold')).toHaveTextContent('0.7');
      expect(screen.getByTestId('assistant-relaxed-threshold')).toHaveTextContent('0.8');

      fireEvent.change(screen.getByTestId('assistant-property-tone'), { target: { value: 'Formal' } });
      fireEvent.click(screen.getByTestId('assistant-property-save'));

      await waitFor(() =>
        expect(assistantSettingsApi.savePropertySettings).toHaveBeenCalledWith('p1', {
          enabled: null,
          tone: 'Formal',
          signature: null,
          hoursFrom: null,
          hoursTo: null,
          confidenceThreshold: 0.7,
          forbiddenTopics: [],
        }),
      );
    });

    it('propertyPanel_NotFoundAnswer_IsNotFoundEvenWithTheOlderAnswerInTheCache', async () => {
      vi.mocked(assistantSettingsApi.getPropertySettings).mockRejectedValue(httpError(404, { code: 'property_not_found' }));
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      client.setQueryData(['assistant', 'property-settings', 'p1'], NO_EXCEPTIONS);
      render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`${URL}&propertyId=p1`]}>
            <Routes>
              <Route path="/app/short-rent/settings/assistant" element={<AssistantSettingsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(await screen.findByTestId('assistant-property-not-found')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-property-form')).not.toBeInTheDocument();
    });

    it('propertyPanel_RemovingTheExceptions_AsksFirstAndThenFollowsTheOrganization', async () => {
      vi.mocked(assistantSettingsApi.getPropertySettings).mockResolvedValue({ ...NO_EXCEPTIONS, tone: 'Formal' });
      vi.mocked(assistantSettingsApi.deletePropertySettings).mockResolvedValue(undefined);
      renderPage(`${URL}&propertyId=p1`);

      fireEvent.click(await screen.findByTestId('assistant-property-reset'));
      expect(assistantSettingsApi.deletePropertySettings).not.toHaveBeenCalled();

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Torna all’organizzazione' }));

      await waitFor(() => expect(assistantSettingsApi.deletePropertySettings).toHaveBeenCalledWith('p1'));
    });
  });

  describe('the knowledge of a property', () => {
    const URL = '/app/short-rent/settings/assistant?tab=properties&propertyId=p1';

    it('knowledgeList_AddingAnAnswer_SendsTheWholeEntry', async () => {
      vi.mocked(assistantSettingsApi.createPropertyEntry).mockResolvedValue(entry());
      renderPage(URL);

      fireEvent.click(await screen.findByTestId('assistant-entry-add'));
      const dialog = await screen.findByTestId('assistant-entry-dialog');
      fireEvent.change(within(dialog).getByTestId('assistant-entry-title'), { target: { value: 'Si può parcheggiare?' } });
      fireEvent.change(within(dialog).getByTestId('assistant-entry-text'), { target: { value: 'Sì, in cortile.' } });
      fireEvent.click(within(dialog).getByTestId('assistant-entry-save'));

      await waitFor(() =>
        expect(assistantSettingsApi.createPropertyEntry).toHaveBeenCalledWith('p1', {
          topic: 'Faq',
          kind: 'Faq',
          title: 'Si può parcheggiare?',
          text: 'Sì, in cortile.',
          language: null,
          isActive: true,
        }),
      );
    });

    it('knowledgeList_FaqWithoutQuestion_IsNotSent', async () => {
      renderPage(URL);

      fireEvent.click(await screen.findByTestId('assistant-entry-add'));
      const dialog = await screen.findByTestId('assistant-entry-dialog');
      fireEvent.change(within(dialog).getByTestId('assistant-entry-text'), { target: { value: 'Sì, in cortile.' } });
      fireEvent.click(within(dialog).getByTestId('assistant-entry-save'));

      expect(await within(dialog).findByText('Scrivi la domanda.')).toBeInTheDocument();
      expect(assistantSettingsApi.createPropertyEntry).not.toHaveBeenCalled();
    });

    it('knowledgeList_AddOfAMissingTopic_StartsOnThatTopic', async () => {
      renderPage(URL);

      const missing = await screen.findByTestId('assistant-missing-topic');
      fireEvent.click(within(missing).getByRole('button', { name: 'Aggiungi' }));

      const dialog = await screen.findByTestId('assistant-entry-dialog');
      expect(within(dialog).getAllByRole('combobox')[0]).toHaveValue('Parking');
    });

    it('knowledgeList_AnswerOfTheOrganizationShownUnderTheProperty_CannotBeChangedThere', async () => {
      renderPage(URL);

      const rows = await screen.findAllByTestId('assistant-entry');
      const inherited = rows.find((row) => row.getAttribute('data-entry-id') === 'e2')!;
      expect(inherited).toHaveTextContent('Dall’organizzazione');
      expect(within(inherited).queryByRole('button')).not.toBeInTheDocument();
    });

    it('knowledgeList_Delete_AsksFirstAndThenDeletesTheEntryOfThisProperty', async () => {
      vi.mocked(assistantSettingsApi.deletePropertyEntry).mockResolvedValue(undefined);
      renderPage(URL);

      const rows = await screen.findAllByTestId('assistant-entry');
      fireEvent.click(within(rows.find((row) => row.getAttribute('data-entry-id') === 'e1')!).getByRole('button', { name: 'Elimina' }));
      expect(assistantSettingsApi.deletePropertyEntry).not.toHaveBeenCalled();

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));

      await waitFor(() => expect(assistantSettingsApi.deletePropertyEntry).toHaveBeenCalledWith('p1', 'e1'));
    });

    it('knowledgeList_AnyRequestInFlight_EveryButtonOfTheListWaits', async () => {
      const pending = deferred<KnowledgeEntry>();
      vi.mocked(assistantSettingsApi.updatePropertyEntry).mockReturnValue(pending.promise);
      renderPage(URL);

      const rows = await screen.findAllByTestId('assistant-entry');
      const own = rows.find((row) => row.getAttribute('data-entry-id') === 'e1')!;
      fireEvent.click(within(own).getByRole('switch'));

      await waitFor(() => expect(within(own).getByRole('button', { name: 'Modifica' })).toBeDisabled());
      expect(within(own).getByRole('button', { name: 'Elimina' })).toBeDisabled();
      expect(within(own).getByRole('switch')).toBeDisabled();
      expect(screen.getByTestId('assistant-entry-add')).toBeDisabled();
      // Switching it off sends the whole entry with the one change.
      expect(assistantSettingsApi.updatePropertyEntry).toHaveBeenCalledWith('p1', 'e1', {
        topic: 'WiFi',
        kind: 'Faq',
        title: 'Qual è la password del Wi-Fi?',
        text: 'È sul frigorifero: tramonto2026.',
        language: null,
        isActive: false,
      });

      pending.resolve(entry({ isActive: false }));
    });
  });

  describe('the answers of the organization', () => {
    it('knowledgeList_OrganizationAnswers_AreAddedByTheAdministratorToTheWholeOrganization', async () => {
      vi.mocked(assistantSettingsApi.createOrganizationEntry).mockResolvedValue(entry({ propertyId: null }));
      renderPage();

      fireEvent.click(await screen.findByTestId('assistant-entry-add'));
      const dialog = await screen.findByTestId('assistant-entry-dialog');
      fireEvent.change(within(dialog).getByTestId('assistant-entry-title'), { target: { value: 'Animali?' } });
      fireEvent.change(within(dialog).getByTestId('assistant-entry-text'), { target: { value: 'Sì, piccoli.' } });
      fireEvent.click(within(dialog).getByTestId('assistant-entry-save'));

      await waitFor(() => expect(assistantSettingsApi.createOrganizationEntry).toHaveBeenCalledWith(expect.objectContaining({ title: 'Animali?', text: 'Sì, piccoli.' })));
      expect(assistantSettingsApi.createPropertyEntry).not.toHaveBeenCalled();
    });

    it('knowledgeList_PersonWhoIsNotTheAdministrator_CannotAddAnswersToTheOrganization', async () => {
      grants.permissions = new Set(['booking.read', 'property.read', 'property.write']);
      renderPage();

      expect(await screen.findByTestId('assistant-entries-none')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-entry-add')).not.toBeInTheDocument();
    });
  });
});
