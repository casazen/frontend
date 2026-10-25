import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { todayInRome } from '@/lib/stay-dates';
import { useImuNotificationStatus } from '@/queries/use-canone-concordato';
import { useLeaseDocuments } from '@/queries/use-lease-documents';
import { useLongRentRules } from '@/queries/use-lease-draft';
import { useRliAdvisory } from '@/queries/use-leases';
import type { CedolareAdvisoryInput, LeaseDetail, LeaseStage } from '@/types';
import { hasAttestation } from '../lib/lease-benefits';
import { isPartnerDraft } from '../lib/lease-sheet';
import { AdviceItem } from './advice-item';
import type { GuideTool } from './advice-catalogue';
import { buildGuideFacts, guideValues } from './guide-facts';
import { GuideToolDialog } from './guide-tool-dialog';
import { GuideTools } from './guide-tools';
import { ADVICE_SHOWN, selectAdvice } from './select-advice';

interface LeaseGuideProps {
  lease: LeaseDetail;
  /** Where the lease stands on its path, as the server says it; `undefined` when the list did not say (the status then decides). */
  stage: LeaseStage | undefined;
  /** The step «Cosa devi fare ora» shows above the tabs, so that the guide does not say it again; `null` when the sheet shows none. */
  stepCode: string | null;
}

/**
 * The guide of a lease (LR-GUIDE-1), the tab the sheet opens on. «Per il tuo contratto»: at most three pieces of advice picked from the
 * catalogue for the type, the moment and the data of this contract, with «Mostra tutti i consigli» for the rest (what the sheet already
 * says in «Cosa devi fare ora» is not repeated here). «Strumenti»: the two tools that answer a question with the data of the contract,
 * the tax comparison and, for a canone concordato, the check of the rent against the agreement.
 *
 * It asks the server for what the advice depend on (the figures of the rules, the tax comparison, the documents of a canone concordato)
 * and shows what it has: an advice that needs a datum not answered yet waits for it, and a datum that fails to arrive only leaves out
 * the advice that needed it.
 */
export function LeaseGuide({ lease, stage, stepCode }: LeaseGuideProps) {
  const { t, i18n } = useTranslation();
  const partnerDraft = isPartnerDraft(lease);
  const concordato = lease.contractType === 'Concordato' || lease.isConcordatoFacileSource === true;
  const registered = lease.status === 'Registered';
  // The comparison of the two regimes means nothing without a rent, and a draft made for the guided service has none to compare.
  const hasRent = lease.monthlyRent > 0 && !partnerDraft;

  const rules = useLongRentRules();
  const [advisoryInput, setAdvisoryInput] = useState<CedolareAdvisoryInput | undefined>(undefined);
  const advisory = useRliAdvisory(lease.id, advisoryInput, { enabled: hasRent });
  const documents = useLeaseDocuments(lease.id, concordato);
  const imu = useImuNotificationStatus(lease.id, concordato && registered);
  const [tool, setTool] = useState<GuideTool | null>(null);
  const [showAll, setShowAll] = useState(false);

  const today = todayInRome();
  const ata = advisory.data?.ata;
  const imuApplicable = imu.data?.applicable;
  // The attestation is a document of its own, or the contract file that holds it (CF-DOCS-REAL).
  const attested = documents.data ? hasAttestation(documents.data) : undefined;
  const rulesData = rules.data;

  const facts = useMemo(
    () => buildGuideFacts({ lease, stage, stepCode, today, rules: rulesData, ata, hasAttestation: attested, imuApplicable }),
    [lease, stage, stepCode, today, rulesData, ata, attested, imuApplicable],
  );
  const advice = useMemo(() => selectAdvice(facts), [facts]);
  const values = useMemo(() => guideValues(facts, i18n.language), [facts, i18n.language]);

  const visible = showAll ? advice : advice.slice(0, ADVICE_SHOWN);
  const hasMore = advice.length > ADVICE_SHOWN;
  const showRent = concordato && !partnerDraft && facts.phase !== 'concluded';
  const showTools = !partnerDraft && facts.phase !== 'concluded';

  return (
    <div className="min-w-0 space-y-8" data-testid="lease-guide">
      <PlainSection title={t('leaseGuide.forYou.title')} data-testid="lease-guide-advice">
        {advice.length === 0 ? (
          <p className="text-sm text-foreground/70" data-testid="lease-guide-empty">
            {t('leaseGuide.forYou.empty')}
          </p>
        ) : (
          <>
            <ul role="list" className="divide-y divide-border border-y border-border" data-testid="lease-advice-list">
              {visible.map((entry) => (
                <AdviceItem key={entry.id} entry={entry} lease={lease} values={values} onOpenTool={setTool} />
              ))}
            </ul>
            {hasMore ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-h-11 whitespace-normal px-2 text-primary-text hover:text-primary-text"
                aria-expanded={showAll}
                onClick={() => setShowAll((open) => !open)}
                data-testid="lease-advice-toggle"
              >
                {showAll ? t('leaseGuide.forYou.showLess') : t('leaseGuide.forYou.showAll', { total: advice.length })}
              </Button>
            ) : null}
          </>
        )}
      </PlainSection>

      {showTools ? <GuideTools lease={lease} advisory={hasRent ? advisory.data : undefined} showRent={showRent} onOpenTool={setTool} /> : null}

      <GuideToolDialog
        tool={tool}
        lease={lease}
        advisoryInput={advisoryInput}
        onAdvisoryInputChange={setAdvisoryInput}
        onClose={() => setTool(null)}
      />
    </div>
  );
}
