import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { complianceHealthApi } from '@/api/compliance-health.api';
import { istatApi } from '@/api/istat.api';
import { onboardingApi } from '@/api/onboarding.api';
import { COLLABORATOR, OWNER } from '@/features/onboarding/__tests__/onboarding-fixtures';
import type { ComplianceConnectionHealth, ConnectionHealthLine } from '@/types';
import type { PropertyIstatCoverage } from '@/types/istat.types';
import { ConnectionHealthPanel } from '../components/connection-health-panel';
import { IstatCoverageNotice } from '../components/istat-coverage-notice';

vi.mock('@/api/istat.api', () => ({ istatApi: { getCoverage: vi.fn() } }));
vi.mock('@/api/compliance-health.api', () => ({ complianceHealthApi: { getConnectionHealth: vi.fn() } }));
vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { listAssistRequests: vi.fn(), requestAssist: vi.fn() } }));

const session = vi.hoisted(() => ({
  flags: { octorateOnboarding: true } as Record<string, boolean>,
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  permissions: [] as string[],
}));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: session.flags, isLoading: false }) }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    contexts: session.contexts,
    hasPermission: (context: string, permission: string) => context === 'short-rent' && session.permissions.includes(permission),
  }),
}));

const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const PANEL_STEP_ADDRESS = `/app/short-rent/onboarding/panel/istat?propertyId=${PROPERTY_ID}`;

/** What the region table says of the ISTAT of the property: a region the staff verified, which the channel manager covers. A test changes what it is about. */
function coverageOf(change: Partial<PropertyIstatCoverage> = {}): PropertyIstatCoverage {
  return {
    propertyId: PROPERTY_ID,
    applies: true,
    regionKnown: true,
    regionIstatCode: '03',
    provinceCode: null,
    regionName: 'Lombardia',
    system: 'Ross1000',
    portalUrl: 'https://portale.example.com/guida',
    deadlineKind: 'Monthly',
    deadlineDay: 5,
    requiredGuestFields: [],
    requiredGuestFieldsKnown: true,
    coverage: 'Covered',
    istatSender: 'ChannelManager',
    nextStep: 'ConnectInPanel',
    assistContext: null,
    sourceUrl: 'https://fonte.example.com/regioni',
    verifiedAt: '2026-11-10T09:00:00Z',
    ...change,
  };
}

function problem(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: {}, statusText: '', headers: {}, config });
}

const line = (change: Partial<ConnectionHealthLine> = {}): ConnectionHealthLine => ({
  sender: 'ChannelManager',
  state: 'Active',
  connectionValid: true,
  autorun: true,
  lastAutomaticRunAt: '2026-11-12T12:05:00Z',
  reason: null,
  declaredAt: null,
  ...change,
});

const health = (): ComplianceConnectionHealth => ({
  propertyId: PROPERTY_ID,
  applies: true,
  alloggiati: line(),
  istat: line(),
  credentialsInCasaZen: false,
  credentialsUsable: false,
  checkedAt: '2026-11-13T10:00:00Z',
});

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

const renderNotice = (showProof = false, options: { inWizard?: boolean; senderOpen?: boolean } = {}) => wrap(<IstatCoverageNotice propertyId={PROPERTY_ID} showProof={showProof} {...options} />);

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  session.flags = { octorateOnboarding: true };
  session.contexts = OWNER;
  session.permissions = ['property.read', 'property.write', 'booking.read'];
  vi.mocked(istatApi.getCoverage).mockReset().mockResolvedValue(coverageOf());
  vi.mocked(onboardingApi.listAssistRequests).mockReset().mockResolvedValue([]);
  vi.mocked(onboardingApi.requestAssist).mockReset();
  vi.mocked(complianceHealthApi.getConnectionHealth).mockReset().mockResolvedValue(health());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('IstatCoverageNotice: a region that is not verified is never shown as covered (data)', () => {
  const NOT_VERIFIED: Array<[string, Partial<PropertyIstatCoverage>]> = [
    ['ARowNobodyVerified', { coverage: 'Unknown', nextStep: 'AskSupport', verifiedAt: null }],
    ['CoveredWithNoDateOfTheCheck', { verifiedAt: null }],
    ['CoveredWhoseNextStepIsToAskSupport', { nextStep: 'AskSupport' }],
    ['CoveredForATerritoryTheTableDoesNotKnow', { regionKnown: false }],
    ['ACoverageThisVersionDoesNotKnow', { coverage: 'Maybe' as never }],
    ['NoCoverageAtAll', { coverage: undefined as never }],
    ['NotCoveredWithTheNextStepOfACoveredRegion', { coverage: 'NotCovered', nextStep: 'ConnectInPanel' }],
  ];

  it.each(NOT_VERIFIED)('IstatCoverageNotice_%s_IsToVerifyAndOffersOnlyTheRequestToSupport', async (_what, change) => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf(change));
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'toVerify');
    expect(notice).toHaveTextContent(text('istatCoverage.title.toVerify'));
    expect(notice).not.toHaveTextContent(text('istatCoverage.title.covered'));
    expect(notice).not.toHaveTextContent(text('istatCoverage.title.notCovered'));
    expect(notice).not.toHaveTextContent(text('istatCoverage.detail.covered'));
    expect(screen.queryByTestId('istat-coverage-panel-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('istat-coverage-portal')).not.toBeInTheDocument();
    expect(await screen.findByTestId('assist-request-button')).toBeInTheDocument();
  });

  it('IstatCoverageNotice_TheSeededRowOfARegionWithAMonthlyDeadline_SaysItsValuesAreNotVerifiedYet', async () => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ coverage: 'Unknown', nextStep: 'AskSupport', verifiedAt: null }));
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(within(notice).getByTestId('istat-coverage-region')).toHaveTextContent(text('istatCoverage.region.named', { region: 'Lombardia', system: 'Ross1000' }));
    expect(within(notice).getByTestId('istat-coverage-unverified')).toHaveTextContent(text('istatCoverage.unverified'));
    expect(within(notice).getByTestId('istat-coverage-detail')).toHaveTextContent(text('istatCoverage.detail.toVerify'));
  });

  it('IstatCoverageNotice_ATerritoryTheTableDoesNotKnow_SaysSoAndNeverNamesARegion', async () => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(
      coverageOf({ regionKnown: false, regionName: null, system: null, portalUrl: null, deadlineKind: 'Unknown', deadlineDay: null, coverage: 'Unknown', nextStep: 'AskSupport', verifiedAt: null }),
    );
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(within(notice).getByTestId('istat-coverage-region')).toHaveTextContent(text('istatCoverage.region.unknown'));
    expect(within(notice).getByTestId('istat-coverage-deadline')).toHaveTextContent(text('istatCoverage.deadline.toVerify'));
    expect(within(notice).queryByTestId('istat-coverage-unverified')).not.toBeInTheDocument();
  });
});

describe('IstatCoverageNotice: the three next steps, one action each', () => {
  it('IstatCoverageNotice_CoveredRegion_SaysItInWordsAndLeadsToTheStepOfThePanel', async () => {
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'covered');
    expect(notice).toHaveTextContent(text('istatCoverage.title.covered'));
    expect(within(notice).getByTestId('istat-coverage-region')).toHaveTextContent(text('istatCoverage.region.named', { region: 'Lombardia', system: 'Ross1000' }));
    expect(within(notice).getByTestId('istat-coverage-deadline')).toHaveTextContent(text('istatCoverage.deadline.monthly', { day: 5 }));
    expect(within(notice).getByTestId('istat-coverage-panel-step')).toHaveAttribute('href', PANEL_STEP_ADDRESS);
    expect(within(notice).queryByTestId('istat-coverage-unverified')).not.toBeInTheDocument();
    expect(within(notice).queryByTestId('istat-coverage-portal')).not.toBeInTheDocument();
    expect(within(notice).queryByTestId('assist-request-button')).not.toBeInTheDocument();
    expect(notice.textContent ?? '').not.toMatch(/octorate/i);
  });

  it('IstatCoverageNotice_CoveredRegionForWhoMayNotWriteTheProperty_SaysItWithoutALinkToTheStep', async () => {
    session.permissions = ['property.read'];
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'covered');
    expect(screen.queryByTestId('istat-coverage-panel-step')).not.toBeInTheDocument();
  });

  it('IstatCoverageNotice_NotCoveredRegion_SaysItAndOpensThePortalOfTheRegionInAnotherTab', async () => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ coverage: 'NotCovered', nextStep: 'ManualPortal', deadlineKind: 'Daily', deadlineDay: null }));
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'notCovered');
    expect(notice).toHaveTextContent(text('istatCoverage.title.notCovered'));
    expect(within(notice).getByTestId('istat-coverage-deadline')).toHaveTextContent(text('istatCoverage.deadline.daily'));
    const portal = within(notice).getByTestId('istat-coverage-portal');
    expect(portal).toHaveAttribute('href', 'https://portale.example.com/guida');
    expect(portal).toHaveAttribute('target', '_blank');
    expect(portal).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(notice).queryByTestId('istat-coverage-panel-step')).not.toBeInTheDocument();
  });

  it.each([
    ['NoAddress', null],
    ['AnAddressThatIsNotHttps', 'http://portale.example.com/guida'],
    ['AScriptAsAnAddress', 'javascript:alert(1)'],
  ])('IstatCoverageNotice_NotCoveredRegionWithPortal_%s_OpensNothingAndLeadsToSupport', async (_what, portalUrl) => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ coverage: 'NotCovered', nextStep: 'ManualPortal', portalUrl }));
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'notCovered');
    expect(notice.querySelector('a[href]')).toBeNull();
    expect(within(notice).getByTestId('istat-coverage-portal-missing')).toHaveTextContent(text('istatCoverage.portalMissing'));
    expect(await screen.findByTestId('assist-request-button')).toBeInTheDocument();
  });

  it('IstatCoverageNotice_RegionToVerify_AsksSupportOnceWithTheContextOfTheIstatStep', async () => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ coverage: 'Unknown', nextStep: 'AskSupport', assistContext: 'panelIstat', verifiedAt: null }));
    vi.mocked(onboardingApi.requestAssist).mockResolvedValue({
      id: 'req-1',
      part: 'compliance',
      propertyId: PROPERTY_ID,
      context: 'panelIstat',
      status: 'Requested',
      requestedAt: '2026-11-15T10:00:00Z',
      updatedAt: '2026-11-15T10:00:00Z',
      completedAt: null,
      staffNote: null,
      activityId: 'a1',
    });
    renderNotice();

    const ask = await screen.findByTestId('assist-request-button');
    expect(ask).toHaveTextContent(text('onboardingPlan.panel.assist.action.askSupport'));
    fireEvent.click(ask);

    await waitFor(() => expect(onboardingApi.requestAssist).toHaveBeenCalledTimes(1));
    expect(onboardingApi.requestAssist).toHaveBeenCalledWith({ part: 'compliance', context: 'panelIstat', propertyId: PROPERTY_ID });
    expect(await screen.findByTestId('assist-request-status')).toHaveAttribute('data-status', 'Requested');
    expect(screen.queryByTestId('assist-request-button')).not.toBeInTheDocument();
  });

  it('IstatCoverageNotice_RegionToVerifyForWhoIsNotTheOrganizationAdministrator_SaysWhoCanAskAndOffersNoButton', async () => {
    session.contexts = COLLABORATOR;
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ coverage: 'Unknown', nextStep: 'AskSupport', verifiedAt: null }));
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(within(notice).getByTestId('istat-coverage-support-admin-only')).toHaveTextContent(text('istatCoverage.action.supportAdminOnly'));
    expect(screen.queryByTestId('assist-request-button')).not.toBeInTheDocument();
    expect(onboardingApi.requestAssist).not.toHaveBeenCalled();
  });
});

// A wizard never takes the person out of the process, and what was typed in it (the credentials are in its state only) is lost when the page is left: inside a wizard the step of the panel
// is told in words and no link leaves it; outside it the link is the organization administrator's, and whoever may only write the property is told who does the step.
describe('IstatCoverageNotice: the step of the panel inside and outside a wizard', () => {
  it('IstatCoverageNotice_CoveredRegionInAWizard_SaysTheNextStepInWordsAndLeadsNowhere', async () => {
    renderNotice(false, { inWizard: true });

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'covered');
    expect(within(notice).getByTestId('istat-coverage-panel-step-later')).toHaveTextContent(text('istatCoverage.action.panelStepInWizard'));
    expect(screen.queryByTestId('istat-coverage-panel-step')).not.toBeInTheDocument();
    expect(notice.querySelector('a[href]')).toBeNull();
  });

  it('IstatCoverageNotice_CoveredRegionOutsideAWizardForWhoIsNotTheOrganizationAdministrator_SaysWhoDoesTheStepAndLinksNowhere', async () => {
    session.contexts = COLLABORATOR;
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'covered');
    expect(within(notice).getByTestId('istat-coverage-panel-step-admin-only')).toHaveTextContent(text('onboardingPlan.panel.adminOnly'));
    expect(screen.queryByTestId('istat-coverage-panel-step')).not.toBeInTheDocument();
    expect(notice.querySelector('a[href]')).toBeNull();
  });

  it('IstatCoverageNotice_CoveredRegionOutsideAWizardForTheOrganizationAdministrator_LeadsToTheGuidedStep', async () => {
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(within(notice).getByTestId('istat-coverage-panel-step')).toHaveAttribute('href', PANEL_STEP_ADDRESS);
    expect(within(notice).queryByTestId('istat-coverage-panel-step-admin-only')).not.toBeInTheDocument();
  });
});

// The coverage of the region is what the channel manager does there; who sends the ISTAT of this property is another word (`istatSender`): a property whose ISTAT is sent by the host or by CasaZen is
// never told «lo invia il tuo channel manager», except on the first step of the wizard, where the sender is still to be chosen.
describe('IstatCoverageNotice: it accounts for who sends the ISTAT of the property', () => {
  const OTHER_SENDERS: Array<['Manual' | 'CasaZen']> = [['Manual'], ['CasaZen']];

  it.each(OTHER_SENDERS)('IstatCoverageNotice_CoveredRegionWhoseIstatIsSentBy%s_NeverSaysTheChannelManagerSendsIt', async (sender) => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ istatSender: sender }));
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'otherSender');
    expect(notice).toHaveTextContent(text('istatCoverage.title.otherSender'));
    expect(notice).not.toHaveTextContent(text('istatCoverage.title.covered'));
    expect(notice).not.toHaveTextContent(text('istatCoverage.detail.covered'));
    expect(screen.queryByTestId('istat-coverage-panel-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assist-request-button')).not.toBeInTheDocument();
    expect(within(notice).getByTestId('istat-coverage-portal')).toHaveAttribute('href', 'https://portale.example.com/guida');
  });

  it('IstatCoverageNotice_IstatSentByTheHostAndNoPortalStated_OffersNoActionAtAll', async () => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ istatSender: 'Manual', portalUrl: null }));
    renderNotice();

    const notice = await screen.findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'otherSender');
    expect(notice.querySelector('a[href]')).toBeNull();
    expect(screen.queryByTestId('assist-request-button')).not.toBeInTheDocument();
  });

  it('IstatCoverageNotice_FirstStepOfTheWizardWhereTheSenderIsToBeChosen_TellsWhatTheChannelManagerDoesWhoeverSendsToday', async () => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ istatSender: 'Manual' }));
    renderNotice(false, { inWizard: true, senderOpen: true });

    expect(await screen.findByTestId('istat-coverage-notice')).toHaveAttribute('data-coverage', 'covered');
  });

  it('IstatCoverageNotice_SenderThisVersionDoesNotKnow_IsToVerifyAndNeverCovered', async () => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ istatSender: 'Somebody' as never }));
    renderNotice();

    expect(await screen.findByTestId('istat-coverage-notice')).toHaveAttribute('data-coverage', 'toVerify');
  });
});

describe('IstatCoverageNotice: flag, property and failed reads', () => {
  it('IstatCoverageNotice_ActivationFlagOff_DrawsNothingAndAsksNothing', async () => {
    session.flags = { octorateOnboarding: false };
    const { container } = renderNotice(true);

    await act(async () => undefined);
    expect(container).toBeEmptyDOMElement();
    expect(istatApi.getCoverage).not.toHaveBeenCalled();
  });

  it('IstatCoverageNotice_PropertyOutsideItaly_DrawsNothing', async () => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf({ applies: false, regionKnown: false, regionName: null, coverage: 'Unknown', nextStep: null }));
    const { container } = renderNotice();

    await waitFor(() => expect(istatApi.getCoverage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('istat-coverage-loading')).not.toBeInTheDocument());
    expect(container).toBeEmptyDOMElement();
  });

  it('IstatCoverageNotice_WhileItLoads_SaysSoAndClaimsNothing', () => {
    vi.mocked(istatApi.getCoverage).mockReturnValue(new Promise(() => undefined));
    renderNotice();

    expect(screen.getByTestId('istat-coverage-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('istat-coverage-notice')).not.toBeInTheDocument();
  });

  it('IstatCoverageNotice_ReadFails_IsAnErrorWithRetryAndNeverACoverage', async () => {
    vi.mocked(istatApi.getCoverage).mockRejectedValueOnce(problem(500));
    renderNotice();

    const error = await screen.findByTestId('istat-coverage-error');
    expect(error).toHaveTextContent(text('istatCoverage.loadError'));
    expect(error).toHaveTextContent(text('istatCoverage.title.toVerify'));
    expect(screen.queryByTestId('istat-coverage-notice')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: text('istatCoverage.retry') }));
    expect(await screen.findByTestId('istat-coverage-notice')).toHaveAttribute('data-coverage', 'covered');
  });

  it('IstatCoverageNotice_ReadFailsAfterAGoodOne_SaysNothingFromTheOlderAnswer', async () => {
    const { client } = renderNotice();
    expect(await screen.findByTestId('istat-coverage-notice')).toHaveAttribute('data-coverage', 'covered');

    vi.mocked(istatApi.getCoverage).mockRejectedValue(problem(500));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['istat-coverage', PROPERTY_ID] });
    });

    expect(await screen.findByTestId('istat-coverage-error')).toBeInTheDocument();
    expect(screen.queryByTestId('istat-coverage-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('istat-coverage-panel-step')).not.toBeInTheDocument();
  });

  it('IstatCoverageNotice_PropertyNotFoundAfterAGoodAnswer_IsNotTheOlderCoverage', async () => {
    const { client } = renderNotice();
    expect(await screen.findByTestId('istat-coverage-notice')).toHaveAttribute('data-coverage', 'covered');

    vi.mocked(istatApi.getCoverage).mockRejectedValue(problem(404));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['istat-coverage', PROPERTY_ID] });
    });

    await waitFor(() => expect(screen.queryByTestId('istat-coverage-notice')).not.toBeInTheDocument());
    expect(screen.queryByTestId('istat-coverage-error')).not.toBeInTheDocument();
  });
});

describe('IstatCoverageNotice: on the page of the property', () => {
  it('IstatCoverageNotice_WithTheProof_OpensTheUploadOfTheMonthThatIsOverOnTheIstatProofOfTheProperty', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T10:00:00Z'));
    // Who may submit the Alloggiati is who may upload to the archive.
    session.permissions = [...session.permissions, 'alloggiati.submit'];
    renderNotice(true);

    const link = await screen.findByTestId('istat-coverage-proof-link');
    expect(link).toHaveAttribute('href', `/app/short-rent/alloggiati/reports?kind=IstatProof&property=${PROPERTY_ID}&period=2026-10`);
    expect(link).toHaveTextContent(text('istatCoverage.proof.action', { month: 'ottobre 2026' }));
    expect(screen.getByTestId('istat-coverage-proof')).toHaveTextContent(text('istatCoverage.proof.lead'));
  });

  it('IstatCoverageNotice_ProofForWhoMayOpenTheArchiveButNotUploadToIt_IsToldOpenAndNeverUpload', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T10:00:00Z'));
    // `booking.read` opens the archive; without `alloggiati.submit` the page has no upload (the default permissions of these tests).
    renderNotice(true);

    const link = await screen.findByTestId('istat-coverage-proof-link');
    expect(link).toHaveAttribute('href', `/app/short-rent/alloggiati/reports?kind=IstatProof&property=${PROPERTY_ID}&period=2026-10`);
    expect(link).toHaveTextContent(text('istatCoverage.proof.open', { month: 'ottobre 2026' }));
    expect(link).not.toHaveTextContent(text('istatCoverage.proof.action', { month: 'ottobre 2026' }));
  });

  it('IstatCoverageNotice_WithoutTheProofProp_OffersNoUploadLikeTheWizard', async () => {
    renderNotice(false);

    await screen.findByTestId('istat-coverage-notice');
    expect(screen.queryByTestId('istat-coverage-proof')).not.toBeInTheDocument();
  });

  it('IstatCoverageNotice_WhoMayNotOpenTheArchive_IsOfferedNoLinkToIt', async () => {
    session.permissions = ['property.read', 'property.write'];
    renderNotice(true);

    await screen.findByTestId('istat-coverage-notice');
    expect(screen.queryByTestId('istat-coverage-proof-link')).not.toBeInTheDocument();
  });

  it('ConnectionHealthPanel_ActivationFlagOn_DrawsTheCoverageNoticeUnderTheStatesWithTheProofOfTheMonth', async () => {
    wrap(<ConnectionHealthPanel propertyId={PROPERTY_ID} timeZone="Europe/Rome" />);

    const panel = await screen.findByTestId('connection-health-panel');
    const notice = await within(panel).findByTestId('istat-coverage-notice');
    expect(notice).toHaveAttribute('data-coverage', 'covered');
    expect(within(panel).getByTestId('connection-health-Istat')).toBeInTheDocument();
    expect(within(panel).getByTestId('istat-coverage-proof-link')).toBeInTheDocument();
    expect(panel.textContent ?? '').not.toMatch(/octorate/i);
  });

  it('ConnectionHealthPanel_ActivationFlagOff_IsWhatItWasWithNoCoverageNoticeAndNoRequest', async () => {
    session.flags = { octorateOnboarding: false };
    wrap(<ConnectionHealthPanel propertyId={PROPERTY_ID} timeZone="Europe/Rome" />);

    // The row of the ISTAT is what the state of the police connection says, as it was.
    expect(await screen.findByTestId('connection-health-Istat')).toHaveAttribute('data-state', 'Active');
    expect(screen.queryByTestId('istat-coverage-notice')).not.toBeInTheDocument();
    expect(istatApi.getCoverage).not.toHaveBeenCalled();
  });
});

// The row of the ISTAT of the panel is computed from the state of the police connection alone: it says «Attivo – il tuo channel manager invia i dati» whatever the region. It may only say so
// where the table says the channel manager sends the ISTAT; otherwise it points to the notice below and is never green.
describe('ConnectionHealthPanel: the row of the ISTAT says «Attivo» only where the table says the channel manager sends it', () => {
  const NOT_SENT: Array<[string, Partial<PropertyIstatCoverage>]> = [
    ['ARegionTheChannelManagerDoesNotCover', { coverage: 'NotCovered', nextStep: 'ManualPortal' }],
    ['ARegionNobodyVerified', { coverage: 'Unknown', nextStep: 'AskSupport', verifiedAt: null }],
    ['AnIstatSentByTheHost', { istatSender: 'Manual' }],
  ];

  it.each(NOT_SENT)('ConnectionHealthPanel_%s_NeverGivesTheIstatRowTheGreenActiveAndPointsToTheNotice', async (_what, change) => {
    vi.mocked(istatApi.getCoverage).mockResolvedValue(coverageOf(change));
    wrap(<ConnectionHealthPanel propertyId={PROPERTY_ID} timeZone="Europe/Rome" />);

    const panel = await screen.findByTestId('connection-health-panel');
    await within(panel).findByTestId('istat-coverage-notice');
    const row = within(panel).getByTestId('connection-health-Istat');
    expect(row).toHaveAttribute('data-state', 'Unknown');
    expect(row).toHaveTextContent(text('connectionHealth.istatSeeNotice'));
    expect(row).not.toHaveTextContent(text('connectionHealth.state.Active'));
    expect(row).not.toHaveTextContent(text('connectionHealth.sender.ChannelManager'));
    expect(within(panel).queryByTestId('connection-health-Istat-state')).not.toBeInTheDocument();
    expect(within(panel).getByTestId('connection-health-Alloggiati')).toHaveAttribute('data-state', 'Active');
  });

  it('ConnectionHealthPanel_CoverageReadFails_DoesNotGiveTheIstatRowTheGreenActiveEither', async () => {
    vi.mocked(istatApi.getCoverage).mockRejectedValue(problem(500));
    wrap(<ConnectionHealthPanel propertyId={PROPERTY_ID} timeZone="Europe/Rome" />);

    const panel = await screen.findByTestId('connection-health-panel');
    await within(panel).findByTestId('istat-coverage-error');
    expect(within(panel).getByTestId('connection-health-Istat')).toHaveAttribute('data-state', 'Unknown');
    expect(within(panel).queryByTestId('connection-health-Istat-state')).not.toBeInTheDocument();
  });

  it('ConnectionHealthPanel_RegionTheChannelManagerCovers_KeepsTheRowAsTheStateOfTheConnectionSaysIt', async () => {
    wrap(<ConnectionHealthPanel propertyId={PROPERTY_ID} timeZone="Europe/Rome" />);

    const panel = await screen.findByTestId('connection-health-panel');
    await within(panel).findByTestId('istat-coverage-notice');
    await waitFor(() => expect(within(panel).getByTestId('connection-health-Istat')).toHaveAttribute('data-state', 'Active'));
    expect(within(panel).getByTestId('connection-health-Istat-state')).toHaveTextContent(text('connectionHealth.state.Active'));
  });
});
