import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { guestRegistrationApi } from '@/api/guest-registration.api';
import { propertiesApi } from '@/api/properties.api';
import { problemError } from '@/features/onboarding/__tests__/onboarding-fixtures';
import { guestRegistrationKey } from '@/queries/guestRegistration';
import { expectNoAxeViolations } from '@/test/axe';
import type { GuestRegistration } from '@/types/guest-registration.types';
import { GuestRegistrationCard } from '../guest-registration-card';
import { PROPERTY_ID, TICINO_SUMMARY, card, regime, unknownPlaceCard, zurichCard } from './guest-registration-fixtures';

vi.mock('@/api/guest-registration.api', () => ({ guestRegistrationApi: { get: vi.fn(), setOverride: vi.fn() } }));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getDetail: vi.fn(), update: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** No supplier of software or of a cantonal system is ever named in what the host reads. */
const SUPPLIER = /hoko|unisys|u-stay|feratel|chekin|octorate|concordato\s*facile|smoobu|lodgify/i;

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function renderCard(props: Partial<ComponentProps<typeof GuestRegistrationCard>> = {}, client: QueryClient = newClient()) {
  return {
    client,
    ...render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <GuestRegistrationCard propertyId={PROPERTY_ID} variant="page" canWrite {...props} />
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>,
    ),
  };
}

/** What the server holds: the answer of the host is kept, and the next read says it. */
function serverHolding(initial: GuestRegistration) {
  let stored = initial;
  vi.mocked(guestRegistrationApi.get).mockImplementation(async () => stored);
  vi.mocked(guestRegistrationApi.setOverride).mockImplementation(async (_propertyId, override) => {
    stored = { ...stored, override, effectiveDuty: override ?? 'Ask' };
    return stored;
  });
}

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

beforeEach(async () => {
  await i18n.changeLanguage('it');
  vi.mocked(guestRegistrationApi.get).mockReset().mockResolvedValue(card());
  vi.mocked(guestRegistrationApi.setOverride).mockReset();
  vi.mocked(propertiesApi.getDetail).mockReset().mockResolvedValue({ id: PROPERTY_ID, isInTicino: true, ticinoStructureId: null } as never);
  vi.mocked(propertiesApi.update).mockReset().mockResolvedValue(undefined as never);
});

afterEach(() => {
  cleanup();
});

describe('GuestRegistrationCard, the regime of the canton of a property (E29/F02/US02/T01)', () => {
  // AC1: a Ticino property shows the regime card with the structure-number field and what is missing.
  it('GuestRegistrationCard_TicinoProperty_ShowsTheRuleTheCertaintyTheStructureNumberFieldAndWhatIsMissing', async () => {
    vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ identifierMissing: ['ticino_structure_id_missing'] }));
    renderCard();

    expect(await screen.findByTestId('guest-registration-summary')).toHaveTextContent(TICINO_SUMMARY);
    expect(screen.getByRole('heading', { name: t('guestRegistration.card.title') })).toBeInTheDocument();
    expect(screen.getByTestId('guest-registration-place')).toHaveTextContent('Lugano · Cantone TI');
    // The obligation, the deadline, the retention, where to notify and what CasaZen does, in plain words.
    expect(screen.getByTestId('guest-registration-fact-obligation')).toHaveTextContent(t('guestRegistration.obligation.ReportToAuthority'));
    expect(screen.getByTestId('guest-registration-fact-obligation')).toHaveTextContent(t('guestRegistration.privateRentals.Yes'));
    expect(screen.getByTestId('guest-registration-fact-deadline')).toHaveTextContent(t('guestRegistration.deadline.Hours24FromArrival'));
    expect(screen.getByTestId('guest-registration-fact-retention')).toHaveTextContent('5 anni');
    expect(screen.getByTestId('guest-registration-fact-channel')).toHaveTextContent(t('guestRegistration.channel.PortalFileUpload'));
    expect(screen.getByTestId('guest-registration-fact-support')).toHaveTextContent(t('guestRegistration.support.FileExport'));
    // The certainty is a word and a sentence, and the sentence sends the host to check.
    const certainty = screen.getByTestId('guest-registration-certainty');
    expect(certainty).toHaveAttribute('data-certainty', 'Verified');
    expect(certainty).toHaveTextContent(t('guestRegistration.certainty.Verified.label'));
    expect(certainty).toHaveTextContent(/verifica con il comune o la polizia/i);
    // The duty is raised by the regime itself: nothing to ask the host.
    expect(screen.getByTestId('guest-registration-duty-required')).toHaveTextContent(t('guestRegistration.duty.required'));
    expect(screen.queryByTestId('guest-registration-answer-Required')).not.toBeInTheDocument();
    // What is missing is told as «to complete», with the field of the structure number under it.
    const missing = screen.getByTestId('guest-registration-missing');
    expect(within(missing).getByText(t('guestRegistration.missing.ticino_structure_id_missing'))).toBeInTheDocument();
    expect(await screen.findByTestId('ticino-structure-id-form')).toBeInTheDocument();
  });

  it('GuestRegistrationCard_StructureNumber_IsSavedOnTheProperty_AndTheCardAndTheActivationReadAgain', async () => {
    vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ identifierMissing: ['ticino_structure_id_missing'] }));
    const onChanged = vi.fn();
    const { client } = renderCard({ onChanged });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    fireEvent.change(await screen.findByLabelText(t('swiss.structureId.label')), { target: { value: 'nl-12345678' } });
    fireEvent.click(screen.getByRole('button', { name: t('swiss.structureId.save') }));

    await waitFor(() => expect(propertiesApi.update).toHaveBeenCalledWith(PROPERTY_ID, { ticinoStructureId: 'NL-12345678' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    // The steps of the activation say what the property lacks too: they are read again.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['compliance', 'activation', PROPERTY_ID] });
  });

  it('GuestRegistrationCard_TheStructureNumberIsRefused_TheFieldKeepsWhatWasTypedAndNothingIsToldAsSaved', async () => {
    vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ identifierMissing: ['ticino_structure_id_missing'] }));
    vi.mocked(propertiesApi.update).mockRejectedValue(problemError(422, { code: 'ticino_structure_id_invalid' }));
    const onChanged = vi.fn();
    renderCard({ onChanged });

    fireEvent.change(await screen.findByLabelText(t('swiss.structureId.label')), { target: { value: 'nl-1234' } });
    fireEvent.click(screen.getByRole('button', { name: t('swiss.structureId.save') }));

    // The mutation says why with its toast, the host keeps what was typed and can try again, and the steps are not told that something was saved.
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByLabelText(t('swiss.structureId.label'))).toHaveValue('NL-1234');
    expect(screen.getByRole('button', { name: t('swiss.structureId.save') })).toBeEnabled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByTestId('guest-registration-missing')).toHaveTextContent(t('guestRegistration.missing.ticino_structure_id_missing'));
  });

  it('GuestRegistrationCard_StructureNumberThePropertyHas_IsInTheFieldAndNeverReplacedByAnEmptyOne', async () => {
    vi.mocked(propertiesApi.getDetail).mockResolvedValue({ id: PROPERTY_ID, isInTicino: true, ticinoStructureId: 'NL-99999999' } as never);
    renderCard();

    expect(await screen.findByLabelText(t('swiss.structureId.label'))).toHaveValue('NL-99999999');
  });

  it('GuestRegistrationCard_ThePageVariant_OpensTheOfficialPortalInANewTabAndOnlyFromThere', async () => {
    renderCard({ variant: 'page' });

    const link = await screen.findByTestId('guest-registration-portal-link');
    expect(link).toHaveAttribute('href', 'https://www.notifiche.ti.ch/portale');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link).toHaveTextContent('www.notifiche.ti.ch');
  });

  it('GuestRegistrationCard_AWizardStepInProgress_NeverLeadsOutOfTheProcess_NoLinkToThePortal', async () => {
    const { container } = renderCard({ variant: 'wizard' });

    await screen.findByTestId('guest-registration-summary');
    expect(screen.queryByTestId('guest-registration-portal-link')).not.toBeInTheDocument();
    expect(container.querySelector('a[target="_blank"]')).toBeNull();
    // The host reads where the portal is, and that it opens from the property page when the step is over.
    expect(screen.getByTestId('guest-registration-portal-host')).toHaveTextContent('www.notifiche.ti.ch');
    expect(screen.getByTestId('guest-registration-fact-portal')).toHaveTextContent(t('guestRegistration.card.portalLater'));
  });

  it('GuestRegistrationCard_APortalThatIsNotHttps_IsNeverALink', async () => {
    vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ regime: regime({ portalUrl: 'javascript:alert(1)' }) }));
    renderCard();

    await screen.findByTestId('guest-registration-summary');
    expect(screen.queryByTestId('guest-registration-portal-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-registration-fact-portal')).not.toBeInTheDocument();
  });

  // AC2: a canton whose duty is Ask shows the two answer buttons and the choice is saved.
  describe('a duty the sources do not settle (Ask)', () => {
    it('GuestRegistrationCard_AskDuty_ShowsTheTwoAnswersAndSavesTheChoiceOnTheProperty_ReversibleAtAnyTime', async () => {
      serverHolding(zurichCard());
      renderCard();

      const mustNotify = await screen.findByTestId('guest-registration-answer-Required');
      expect(screen.getByTestId('guest-registration-answer-NotRequired')).toBeEnabled();
      expect(mustNotify).toHaveTextContent('Devo notificare');
      expect(screen.getByTestId('guest-registration-answer-NotRequired')).toHaveTextContent('Non devo notificare');
      // The sources do not settle it: it is told as a question, with the certainty as «partial», and nothing is red.
      expect(screen.getByTestId('guest-registration-duty-ask')).toHaveTextContent(t('guestRegistration.duty.askTitle'));
      expect(screen.getByTestId('guest-registration-certainty')).toHaveAttribute('data-certainty', 'Partial');
      expect(screen.getByTestId('guest-registration-certainty').innerHTML).not.toMatch(/danger|destructive|text-red|bg-red/);
      expect(screen.getByTestId('guest-registration-fact-deadline')).toHaveTextContent('La scadenza non è verificata');
      expect(screen.getByTestId('guest-registration-fact-retention')).toHaveTextContent(t('guestRegistration.retention.none'));

      fireEvent.click(mustNotify);

      await waitFor(() => expect(guestRegistrationApi.setOverride).toHaveBeenCalledWith(PROPERTY_ID, 'Required'));
      expect(await screen.findByTestId('guest-registration-duty-answered')).toHaveTextContent(t('guestRegistration.duty.answeredRequired'));
      expect(screen.queryByTestId('guest-registration-answer-Required')).not.toBeInTheDocument();

      // Reversible: «Cambia risposta» says «follow the regime» again (null), and the question is back.
      fireEvent.click(screen.getByTestId('guest-registration-duty-change'));
      await waitFor(() => expect(guestRegistrationApi.setOverride).toHaveBeenLastCalledWith(PROPERTY_ID, null));
      expect(await screen.findByTestId('guest-registration-answer-NotRequired')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('guest-registration-answer-NotRequired'));
      await waitFor(() => expect(guestRegistrationApi.setOverride).toHaveBeenLastCalledWith(PROPERTY_ID, 'NotRequired'));
      expect(await screen.findByTestId('guest-registration-duty-answered')).toHaveTextContent(t('guestRegistration.duty.answeredNotRequired'));
    });

    // Defect class (4): every button of the card stays off while ANY change of the card is on its way, and a second press is ignored.
    it('GuestRegistrationCard_AnAnswerIsOnItsWay_NothingElseOfTheCardCanBePressed', async () => {
      let finish!: (value: GuestRegistration) => void;
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(zurichCard());
      vi.mocked(guestRegistrationApi.setOverride).mockImplementation(
        () =>
          new Promise<GuestRegistration>((resolve) => {
            finish = resolve;
          }),
      );
      renderCard();
      const mustNotify = await screen.findByTestId('guest-registration-answer-Required');
      const mustNotNotify = screen.getByTestId('guest-registration-answer-NotRequired');

      fireEvent.click(mustNotify);

      await waitFor(() => expect(mustNotNotify).toBeDisabled());
      expect(mustNotify).toHaveAttribute('aria-busy', 'true');
      fireEvent.click(mustNotify);
      fireEvent.click(mustNotNotify);
      expect(guestRegistrationApi.setOverride).toHaveBeenCalledTimes(1);

      await act(async () => {
        finish(zurichCard({ effectiveDuty: 'Required', override: 'Required' }));
      });
    });

    it('GuestRegistrationCard_TheAnswerIsNotSaved_SaysSoNextToTheQuestionAndTheButtonsComeBack', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(zurichCard());
      vi.mocked(guestRegistrationApi.setOverride).mockRejectedValue(problemError(422, { code: 'guest_registration_override_not_applicable' }));
      renderCard();

      fireEvent.click(await screen.findByTestId('guest-registration-answer-Required'));

      expect(await screen.findByTestId('guest-registration-duty-error')).toHaveTextContent(t('apiErrors.codes.guestRegistrationOverrideNotApplicable'));
      // Nothing was saved: the question is still there, and both answers can be pressed again.
      expect(screen.getByTestId('guest-registration-answer-Required')).toBeEnabled();
      expect(screen.getByTestId('guest-registration-answer-NotRequired')).toBeEnabled();
      expect(screen.queryByTestId('guest-registration-duty-answered')).not.toBeInTheDocument();
    });

    it('GuestRegistrationCard_PersonWhoMayNotWrite_ReadsTheQuestionWithNoButtonAndNoField', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(zurichCard());
      renderCard({ canWrite: false });

      expect(await screen.findByTestId('guest-registration-duty-ask')).toBeInTheDocument();
      expect(screen.queryByTestId('guest-registration-answer-Required')).not.toBeInTheDocument();
      expect(screen.queryByTestId('guest-registration-answer-NotRequired')).not.toBeInTheDocument();
    });
  });

  describe('what is missing', () => {
    it('GuestRegistrationCard_TicinoWithAnAnswerOfTheHost_TheNumberAndTheAnswerWaitForEachOther', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ effectiveDuty: 'NotRequired', override: 'NotRequired', identifierMissing: ['ticino_structure_id_missing'] }));
      let finishUpdate!: () => void;
      vi.mocked(propertiesApi.update).mockImplementation(
        () =>
          new Promise((resolve) => {
            finishUpdate = () => resolve(undefined as never);
          }),
      );
      renderCard();
      const change = await screen.findByTestId('guest-registration-duty-change');

      fireEvent.change(await screen.findByLabelText(t('swiss.structureId.label')), { target: { value: 'nl-1234' } });
      fireEvent.click(screen.getByRole('button', { name: t('swiss.structureId.save') }));

      // The number is on its way: the answer cannot be changed meanwhile.
      await waitFor(() => expect(change).toBeDisabled());
      await act(async () => {
        finishUpdate();
      });
      await waitFor(() => expect(change).toBeEnabled());
    });

    it('GuestRegistrationCard_AnAnswerIsOnItsWay_TheStructureNumberCannotBeEditedMeanwhile', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ effectiveDuty: 'Required', override: 'Required' }));
      let finish!: (value: GuestRegistration) => void;
      vi.mocked(guestRegistrationApi.setOverride).mockImplementation(
        () =>
          new Promise<GuestRegistration>((resolve) => {
            finish = resolve;
          }),
      );
      renderCard();
      const input = await screen.findByLabelText(t('swiss.structureId.label'));

      fireEvent.click(await screen.findByTestId('guest-registration-duty-change'));

      await waitFor(() => expect(input).toBeDisabled());
      expect(screen.getByRole('button', { name: t('swiss.structureId.save') })).toBeDisabled();
      await act(async () => {
        finish(card());
      });
      await waitFor(() => expect(input).toBeEnabled());
    });

    it('GuestRegistrationCard_UnknownMunicipality_IsToCompleteWithTheWayToSetItAndNeverAChosenCanton', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(unknownPlaceCard());
      const onFixMunicipality = vi.fn();
      renderCard({ onFixMunicipality });

      const missing = await screen.findByTestId('guest-registration-missing');
      expect(missing).toHaveTextContent(t('guestRegistration.missing.swiss_municipality_missing'));
      expect(screen.getByTestId('guest-registration-certainty')).toHaveAttribute('data-certainty', 'Unverified');
      expect(screen.getByTestId('guest-registration-certainty')).toHaveTextContent(/verifica con il comune o la polizia/i);
      // No canton, no place line, no structure-number field: nobody knows the property is in Ticino.
      expect(screen.queryByTestId('guest-registration-place')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ticino-structure-id-form')).not.toBeInTheDocument();
      // A wizard goes to its own step without leaving the process.
      fireEvent.click(screen.getByTestId('guest-registration-fix-municipality'));
      expect(onFixMunicipality).toHaveBeenCalledTimes(1);
    });

    it('GuestRegistrationCard_UnknownMunicipalityOnAPage_LinksToTheFormOfTheProperty_AndAReaderGetsNoAction', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(unknownPlaceCard());
      const { unmount } = renderCard({ municipalityHref: `/app/short-rent/properties/${PROPERTY_ID}/edit` });

      expect(await screen.findByTestId('guest-registration-fix-municipality')).toHaveAttribute('href', `/app/short-rent/properties/${PROPERTY_ID}/edit`);
      unmount();

      renderCard({ municipalityHref: '/somewhere', canWrite: false });
      await screen.findByTestId('guest-registration-missing');
      expect(screen.queryByTestId('guest-registration-fix-municipality')).not.toBeInTheDocument();
    });

    it('GuestRegistrationCard_ReaderOfATicinoProperty_SeesTheNumberTheCardHasWithNoField', async () => {
      vi.mocked(propertiesApi.getDetail).mockResolvedValue({ id: PROPERTY_ID, isInTicino: true, ticinoStructureId: 'NL-555' } as never);
      renderCard({ canWrite: false });

      expect(await screen.findByTestId('guest-registration-structure-value')).toHaveTextContent('NL-555');
      expect(screen.queryByTestId('ticino-structure-id-form')).not.toBeInTheDocument();
    });

    it('GuestRegistrationCard_AMissingCodeThisVersionDoesNotKnow_IsANeutralLineNeverTheCode', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ identifierMissing: ['a_new_thing_to_do'] }));
      renderCard();

      const missing = await screen.findByTestId('guest-registration-missing');
      expect(missing).toHaveTextContent(t('guestRegistration.missing.unknown'));
      expect(missing).not.toHaveTextContent('a_new_thing_to_do');
    });
  });

  describe('a read that does not work is told as such', () => {
    // Defect class (2): TanStack Query keeps the old data on an error, and a 404 is always «not found».
    it('GuestRegistrationCard_TheReadFailsWith404AfterItWorked_IsNotFoundNeverTheOldAnswer', async () => {
      const { client } = renderCard();
      expect(await screen.findByTestId('guest-registration-summary')).toBeInTheDocument();

      vi.mocked(guestRegistrationApi.get).mockRejectedValue(problemError(404, { code: 'property_not_found' }));
      await act(async () => {
        await client.invalidateQueries({ queryKey: guestRegistrationKey(PROPERTY_ID) });
      });

      expect(await screen.findByTestId('guest-registration-not-found')).toHaveTextContent(t('guestRegistration.card.notFound'));
      expect(screen.queryByTestId('guest-registration-summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('guest-registration-duty')).not.toBeInTheDocument();
    });

    it('GuestRegistrationCard_TheCallerDoesNotReachTheProperty_SaysNoAccess', async () => {
      vi.mocked(guestRegistrationApi.get).mockRejectedValue(problemError(403, {}));
      renderCard();

      expect(await screen.findByTestId('guest-registration-forbidden')).toHaveTextContent(t('guestRegistration.card.forbidden'));
    });

    it('GuestRegistrationCard_ACountryTheCatalogHasNoRegimeFor_SaysSoCalmly', async () => {
      vi.mocked(guestRegistrationApi.get).mockRejectedValue(problemError(422, { code: 'guest_registration_country_not_supported' }));
      renderCard();

      expect(await screen.findByTestId('guest-registration-unsupported')).toHaveTextContent(t('guestRegistration.card.unsupported'));

      cleanup();
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ regime: null }));
      renderCard();
      expect(await screen.findByTestId('guest-registration-unsupported')).toBeInTheDocument();
    });

    it('GuestRegistrationCard_ThePageIsDown_SaysItCannotReadAndOffersToTryAgain', async () => {
      vi.mocked(guestRegistrationApi.get).mockRejectedValueOnce(problemError(500, {}));
      renderCard();

      const failure = await screen.findByTestId('guest-registration-error');
      expect(failure).toHaveTextContent(t('guestRegistration.card.loadFailed'));
      fireEvent.click(within(failure).getByRole('button', { name: t('guestRegistration.card.retry') }));

      expect(await screen.findByTestId('guest-registration-summary')).toBeInTheDocument();
      expect(guestRegistrationApi.get).toHaveBeenCalledTimes(2);
    });

    it('GuestRegistrationCard_WhileItReads_SaysItIsLoading', () => {
      vi.mocked(guestRegistrationApi.get).mockReturnValue(new Promise(() => {}));
      renderCard();

      expect(screen.getByTestId('guest-registration-loading')).toHaveTextContent(t('guestRegistration.card.loading'));
    });
  });

  describe('the words', () => {
    it('GuestRegistrationCard_AnObligationTheServerHasThatThisVersionDoesNotKnow_IsToCheckNeverTheRawValue', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(
        card({ regime: regime({ obligation: 'Mandatory' as never, channel: 'Pigeon' as never, deadlineKind: 'Yearly' as never, casaZenSupport: 'Magic' as never, certainty: 'Maybe' as never }) }),
      );
      renderCard();

      await screen.findByTestId('guest-registration-summary');
      expect(screen.getByTestId('guest-registration-fact-channel')).toHaveTextContent(t('guestRegistration.toVerify'));
      expect(screen.getByTestId('guest-registration-fact-deadline')).toHaveTextContent(t('guestRegistration.toVerify'));
      expect(screen.getByTestId('guest-registration-fact-support')).toHaveTextContent(t('guestRegistration.toVerify'));
      // The certainty this version does not know reads as the most prudent one.
      expect(screen.getByTestId('guest-registration-certainty')).toHaveAttribute('data-certainty', 'Unverified');
      for (const raw of ['Mandatory', 'Pigeon', 'Yearly', 'Magic', 'Maybe']) expect(document.body.textContent).not.toContain(raw);
    });

    it.each(['it', 'en'])('GuestRegistrationCard_%s_NamesNoSupplierAndSaysItIsNotLegalAdvice', async (language) => {
      await i18n.changeLanguage(language);
      for (const answer of [card(), zurichCard(), unknownPlaceCard()]) {
        vi.mocked(guestRegistrationApi.get).mockResolvedValue(answer);
        const { unmount } = renderCard();
        await screen.findByTestId('guest-registration-summary');
        expect(document.body.textContent ?? '').not.toMatch(SUPPLIER);
        expect(screen.getByTestId('guest-registration-certainty').textContent).toMatch(language === 'it' ? /consulenza legale/ : /legal advice/);
        unmount();
      }
    });

    it('GuestRegistrationCard_TheCardOfAnAskDuty_HasNoAccessibilityViolation', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(zurichCard({ identifierMissing: ['swiss_municipality_missing'] }));
      const { container } = renderCard({ municipalityHref: '/edit' });

      await screen.findByTestId('guest-registration-answer-Required');
      await expectNoAxeViolations(container);
    });

    it('GuestRegistrationCard_TicinoWithTheFieldInAWizard_HasNoAccessibilityViolation', async () => {
      vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ identifierMissing: ['ticino_structure_id_missing'] }));
      const { container } = renderCard({ variant: 'wizard' });

      await screen.findByTestId('ticino-structure-id-form');
      await expectNoAxeViolations(container);
    });
  });
});
