import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { formatDeadline } from '@/lib/supplier-site/format';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';

const STEPS = ['choose', 'details', 'hold', 'confirm', 'done'] as const;

/**
 * "Prenoti in cinque passi": what really happens, in the order it happens, with the payment said as it is (the amount is held on the
 * card, charged only if the professional accepts, CasaZen keeps it until the customer confirms, cancelling is free: decisions D2, D6,
 * VT-D1). Shown only while the bookings are open, so only where the payment really is inside CasaZen. The time to answer is the
 * supplier's own setting, never written by hand. Texts to be reviewed by the legal adviser (VT-D20).
 */
export function HowSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const deadline = model.respondWithinMinutes ? formatDeadline(model.respondWithinMinutes, t) : null;

  return (
    <section className="vz-section vz-section--tint" id="come" aria-labelledby="vz-h-how" data-testid="supplier-site-how">
      <div className="vz-container">
        <SectionHead id="vz-h-how" eyebrow={t('supplierSite.how.eyebrow')} title={t('supplierSite.how.title')} />
        <ol className="vz-how">
          {STEPS.map((step, index) => (
            <Reveal key={step} as="li" index={index}>
              <span className="vz-how__n" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{t(`supplierSite.how.steps.${step}.title`, { name: model.name })}</h3>
                <p>
                  {step === 'confirm' && deadline
                    ? t('supplierSite.how.steps.confirm.textDeadline', { deadline })
                    : t(`supplierSite.how.steps.${step}.text`)}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
        <Reveal>
          <p className="vh-how__pay">
            <Lock aria-hidden="true" />
            <span>{t('supplierSite.how.pay')}</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
