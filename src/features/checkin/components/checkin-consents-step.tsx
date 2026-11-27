import { useTranslation } from 'react-i18next';
import type { PublicCheckInContextDto } from '@/types/public-checkin.types';
import { ConsentStep } from '../ConsentStep';

/** The last step: the house rules (when the property has them) and the consents. */
export function CheckInConsentsStep({ context, activeRulesVersion, rulesAccepted, setAcceptedRulesVersion, privacyRead, setPrivacyRead }: {
  context: PublicCheckInContextDto;
  activeRulesVersion: string | undefined;
  rulesAccepted: boolean;
  setAcceptedRulesVersion: (version: string | undefined) => void;
  privacyRead: boolean;
  setPrivacyRead: (read: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {activeRulesVersion && context.houseRules && (
        <section className="space-y-3 border-t pt-4" data-testid="checkin-house-rules">
          <h2 id="checkin-house-rules-title" className="font-semibold">{t('guestPortal.guide.houseRules')}</h2>
          {/* Long rules scroll in their own box, so the box to tick and the button stay near. A named region that takes the focus:
              the keys scroll it, and a screen reader says what it is. */}
          <div
            role="region"
            tabIndex={0}
            aria-labelledby="checkin-house-rules-title"
            className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {context.houseRules}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={rulesAccepted}
              onChange={(event) => setAcceptedRulesVersion(event.target.checked ? activeRulesVersion : undefined)} />
            {t('guestPortal.guide.acceptRules')}
          </label>
        </section>
      )}
      <ConsentStep
        privacyRead={privacyRead}
        onPrivacyRead={setPrivacyRead}
        privacyNoticeVersion={context.privacyNoticeVersion}
        privacyNoticeOrgSlug={context.privacyNoticeOrgSlug}
        marketingConsentVersion={context.marketingConsentVersion}
      />
    </>
  );
}
