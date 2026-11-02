import { useTranslation } from 'react-i18next';
import { Award, ShieldCheck } from 'lucide-react';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';

/**
 * The guarantee and the certifications **the supplier wrote** (SP-13a): CasaZen precompiles none and adds none, so nothing here
 * says "insured", "certified" or "guaranteed" on its own account. "Verificato" is the platform's and lives in the trust bar.
 */
export function GuaranteeSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const { guarantee, certs } = model;

  return (
    <section className="vz-section vz-section--tint" id="garanzie" aria-labelledby="vz-h-certs" data-testid="supplier-site-certs">
      <div className="vz-container">
        <SectionHead id="vz-h-certs" eyebrow={t('supplierSite.certs.eyebrow')} title={t('supplierSite.certs.title')} />
        {guarantee ? (
          <Reveal className="vz-guarantee">
            <ShieldCheck aria-hidden="true" />
            <div>
              {guarantee.title ? <strong>{guarantee.title}</strong> : null}
              {guarantee.text ? <p>{guarantee.text}</p> : null}
            </div>
          </Reveal>
        ) : null}
        {certs.length > 0 ? (
          <ul className="vz-certs">
            {certs.map((cert, index) => (
              <Reveal key={cert.label} as="li" className="vz-cert" index={index}>
                <span className="vz-cert__i">
                  <Award aria-hidden="true" />
                </span>
                <div>
                  <strong>{cert.label}</strong>
                  {cert.detail ? <span>{cert.detail}</span> : null}
                </div>
              </Reveal>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
