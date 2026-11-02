import { useTranslation } from 'react-i18next';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { SITE_STYLE_IDS, SITE_STYLES, type SiteStyleId } from '@/lib/supplier-site/style-config';

interface StyleCardsProps {
  /** The style on screen (the one chosen, or the one recommended for the trade). */
  value: SiteStyleId;
  onChange: (style: SiteStyleId) => void;
  /** The style that fits the trade of the profile: marked "Consigliato per il tuo mestiere". */
  recommended: SiteStyleId | null;
  /** The name of the group of radios. */
  name: string;
}

/** The four styles of the showcase as cards with a sample drawn in CSS (the page color and the button color of the style). */
export function StyleCards({ value, onChange, recommended, name }: StyleCardsProps) {
  const { t } = useTranslation();
  return (
    <ChoiceGroup legend={t('supplier.showcase.editor.style.legend')} minCardWidth={13}>
      {SITE_STYLE_IDS.map((id) => (
        <ChoiceCard
          key={id}
          name={name}
          value={id}
          checked={value === id}
          onChange={() => onChange(id)}
          data-testid={`supplier-showcase-style-${id}`}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span aria-hidden="true" className="inline-flex h-5 w-8 overflow-hidden rounded ring-1 ring-inset ring-black/15" style={{ background: SITE_STYLES[id].bg }}>
                <span className="m-auto h-2.5 w-5 rounded-sm" style={{ background: SITE_STYLES[id].cta }} />
              </span>
              {t(`supplier.showcase.editor.style.${id}.name`)}
              {id === recommended ? <span className="text-xs font-medium text-foreground/70">· {t('supplier.showcase.editor.style.recommended')}</span> : null}
            </span>
          }
          description={t(`supplier.showcase.editor.style.${id}.description`)}
        />
      ))}
    </ChoiceGroup>
  );
}
