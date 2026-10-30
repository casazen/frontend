import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { contrastRatio, AA_TEXT_CONTRAST } from '@/lib/public-site-colors';
import {
  resolveSiteFont,
  resolveSiteStyle,
  SITE_FONT_FAMILIES,
  SITE_FONT_IDS,
  SITE_STYLES,
  recommendedStyleFor,
  siteButtonColor,
  suggestReadableColor,
} from '@/lib/supplier-site/style-config';
import { normalizeHexColor } from '@/lib/public-site-themes';
import { isRefused, type PanelProps } from './panel-types';
import { StyleCards } from './style-cards';

/** The two ways the name is drawn that need no image (the image comes with the upload, SP-13b). */
const LOGO_MODES = ['mark', 'text'] as const;

interface StylePanelProps extends PanelProps {
  /** The categories of the supplier's profile: the style recommended for the trade comes from them. */
  categories: string[];
}

/**
 * "Stile e marchio" (SP-13d): one of the four styles (the one that fits the trade is marked), the color of the buttons, the typeface and
 * the logo. The color is applied only when white text reads on it at 4.5:1: a color that does not is not sent, the panel says how
 * readable it is and offers the same hue, darker (the server checks it again and answers with its own suggestion).
 */
export function StylePanel({ doc, change, invalid, categories }: StylePanelProps) {
  const { t, i18n } = useTranslation();
  const recommended = recommendedStyleFor(categories);
  const style = resolveSiteStyle(doc.style, categories);
  const font = resolveSiteFont(doc.font, style);
  const logoMode = doc.logo?.mode === 'text' ? 'text' : 'mark';

  // What is typed in the field of the color; the draft only holds a color that is readable.
  const [typed, setTyped] = useState(doc.color ?? '');
  const typedColor = normalizeHexColor(typed);
  const readable = siteButtonColor(typed);
  const ratio = typedColor ? contrastRatio(typedColor, '#ffffff') : null;
  const tooLow = typedColor !== null && readable === null;
  const suggestion = invalid.suggestedColor ?? (typedColor ? suggestReadableColor(typedColor) : null);

  const setColor = (value: string) => {
    setTyped(value);
    // An emptied field is "the color of the style"; a color is saved only when white text reads on it.
    if (value.trim() === '') {
      change({ color: null });
      return;
    }
    const color = siteButtonColor(value);
    if (color) change({ color });
  };
  const resetColor = () => {
    setTyped('');
    change({ color: null });
  };

  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const colorError = tooLow
    ? t('supplier.showcase.editor.color.low', { ratio: number(ratio ?? 0, 2), min: number(AA_TEXT_CONTRAST, 1) })
    : typed !== '' && !typedColor
      ? t('supplier.showcase.editor.color.notAColor')
      : isRefused(invalid, 'color')
        ? t('supplier.showcase.editor.color.refused')
        : undefined;

  return (
    <div className="space-y-8" data-testid="supplier-showcase-panel-style">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.style.title')}</h2>
        <StyleCards name="showcase-style" value={style} recommended={recommended} onChange={(id) => change({ style: id })} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.color.title')}</h2>
        <div className="flex flex-wrap items-start gap-3">
          <input
            type="color"
            aria-label={t('supplier.showcase.editor.color.picker')}
            className="h-11 w-14 shrink-0 cursor-pointer rounded-md border bg-background p-1"
            value={typedColor ?? SITE_STYLES[style].cta}
            onChange={(event) => setColor(event.target.value)}
          />
          <Field label={t('supplier.showcase.editor.color.label')} hint={t('supplier.showcase.editor.color.hint')} error={colorError} className="min-w-0 flex-1 basis-56">
            <Input value={typed} placeholder={SITE_STYLES[style].cta} spellCheck={false} onChange={(event) => setColor(event.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {(tooLow || invalid.suggestedColor) && suggestion ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setColor(suggestion)} data-testid="supplier-showcase-color-suggest">
              {t('supplier.showcase.editor.color.useSuggested')}
            </Button>
          ) : null}
          {doc.color || typed ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetColor}>
              {t('supplier.showcase.editor.color.reset')}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.font.title')}</h2>
        <ChoiceGroup legend={t('supplier.showcase.editor.font.legend')} minCardWidth={13}>
          {SITE_FONT_IDS.map((id) => (
            <ChoiceCard
              key={id}
              name="showcase-font"
              value={id}
              checked={font === id}
              onChange={() => change({ font: id })}
              data-testid={`supplier-showcase-font-${id}`}
              title={<span style={{ fontFamily: SITE_FONT_FAMILIES[id] }}>{t(`supplier.showcase.editor.font.${id}.name`)}</span>}
              description={t(`supplier.showcase.editor.font.${id}.description`)}
            />
          ))}
        </ChoiceGroup>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.logo.title')}</h2>
        <ChoiceGroup legend={t('supplier.showcase.editor.logo.legend')} minCardWidth={13}>
          {LOGO_MODES.map((mode) => (
            <ChoiceCard
              key={mode}
              name="showcase-logo"
              value={mode}
              checked={logoMode === mode}
              onChange={() => change({ logo: { mode } })}
              data-testid={`supplier-showcase-logo-${mode}`}
              title={t(`supplier.showcase.editor.logo.${mode}.name`)}
              description={t(`supplier.showcase.editor.logo.${mode}.description`)}
            />
          ))}
        </ChoiceGroup>
      </section>
    </div>
  );
}
