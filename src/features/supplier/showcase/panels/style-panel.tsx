import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isDisplayableMediaUrl } from '@/lib/media-url';
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
import { MediaUpload } from './media-upload';
import { isRefused, type PanelProps } from './panel-types';
import { StyleCards } from './style-cards';

/** The three ways the supplier's name is drawn: its initials and its name, its name alone, or the logo it uploads (SP-13b). */
const LOGO_MODES = ['mark', 'text', 'image'] as const;
type LogoMode = (typeof LOGO_MODES)[number];

interface StylePanelProps extends PanelProps {
  /** The categories of the supplier's profile: the style recommended for the trade comes from them. */
  categories: string[];
}

/**
 * "Stile e marchio" (SP-13d): one of the four styles (the one that fits the trade is marked), the color of the buttons, the typeface and
 * the logo. The color is applied only when white text reads on it at 4.5:1: a color that does not is not sent, the panel says how
 * readable it is and offers the same hue, darker (the server checks it again and answers with its own suggestion). The logo is the initials,
 * the name, or an image the supplier uploads here (a PNG, a JPG or a WebP of 200 KB at most): the draft switches to the image only when the
 * server has it, since a logo "of an image" with no image could not be published.
 */
export function StylePanel({ doc, change, invalid, categories }: StylePanelProps) {
  const { t, i18n } = useTranslation();
  const recommended = recommendedStyleFor(categories);
  const style = resolveSiteStyle(doc.style, categories);
  const font = resolveSiteFont(doc.font, style);
  // The card of the image is chosen as soon as the person picks it, but the draft says "image" only once there is one to show.
  const [imageChosen, setImageChosen] = useState(doc.logo?.mode === 'image');
  const logoUrl = doc.logo?.mode === 'image' && isDisplayableMediaUrl(doc.logo.url) ? doc.logo.url : null;
  const logoMode: LogoMode = imageChosen ? 'image' : doc.logo?.mode === 'text' ? 'text' : 'mark';

  const chooseLogo = (mode: LogoMode) => {
    setImageChosen(mode === 'image');
    // The initials and the name leave the image behind: the card of the image starts again from the upload.
    if (mode !== 'image') change({ logo: { mode } });
  };
  const logoRefused = isRefused(invalid, 'logo');

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
              onChange={() => chooseLogo(mode)}
              data-testid={`supplier-showcase-logo-${mode}`}
              title={mode === 'image' ? t('supplier.showcase.media.logo.card.name') : t(`supplier.showcase.editor.logo.${mode}.name`)}
              description={mode === 'image' ? t('supplier.showcase.media.logo.card.description') : t(`supplier.showcase.editor.logo.${mode}.description`)}
            />
          ))}
        </ChoiceGroup>

        {logoMode === 'image' ? (
          <div className="space-y-3" data-testid="supplier-showcase-logo-image">
            {logoUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <img
                  src={logoUrl}
                  alt=""
                  className="h-12 max-w-[10rem] rounded-md bg-background object-contain p-1 ring-1 ring-border"
                  data-testid="supplier-showcase-logo-preview"
                />
                <p className="min-w-0 flex-1 basis-40 text-sm font-medium">{t('supplier.showcase.media.logo.current')}</p>
                <Button type="button" variant="ghost" onClick={() => chooseLogo('mark')}>
                  {t('supplier.showcase.media.logo.remove')}
                </Button>
              </div>
            ) : null}
            {logoRefused ? (
              <p className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]">{t('supplier.showcase.editor.invalidField')}</p>
            ) : null}
            <MediaUpload
              kind="logo"
              title={logoUrl ? t('supplier.showcase.media.logo.titleChange') : t('supplier.showcase.media.logo.title')}
              buttonLabel={logoUrl ? t('supplier.showcase.media.logo.change') : t('supplier.showcase.media.logo.button')}
              onStored={(media) => change({ logo: { mode: 'image', url: media.url } })}
              data-testid="supplier-showcase-logo-upload"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
