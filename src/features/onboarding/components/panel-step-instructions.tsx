import { useTranslation } from 'react-i18next';
import { PANEL_INSTRUCTION_COUNTS, type PanelTextKind } from '@/lib/onboarding-panel';

/**
 * The pictures of the instructions, supplied by product and design: `src/assets/onboarding/panel/<kind>-<n>.<ext>` (`police-1.png`,
 * `channelAccess-3.webp`...), `<kind>` being `police`, `istat` or `channelAccess` and `<n>` the number of the instruction. Until a picture is
 * there the instruction shows its numbered text alone: never a broken image.
 */
const IMAGE_FILES = import.meta.glob<string>('/src/assets/onboarding/panel/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const IMAGES: ReadonlyMap<string, string> = new Map(
  Object.entries(IMAGE_FILES).map(([path, url]) => [(path.split('/').pop() ?? path).replace(/\.[A-Za-z]+$/, ''), url] as const),
);

interface PanelStepInstructionsProps {
  kind: PanelTextKind;
}

/**
 * The brief, numbered instructions of what the person does on the panel of the channel manager (NF-107, UX-02 point 3): one sentence each, with a
 * picture when the asset exists and the text that describes it. The words are `onboardingPlan.panel.<kind>.steps.<n>` and `.alts.<n>`. The
 * channel manager is called «il tuo channel manager» (UX-12), and the person is told that the credentials are typed on its page, never in CasaZen.
 */
export function PanelStepInstructions({ kind }: PanelStepInstructionsProps) {
  const { t } = useTranslation();
  const numbers = Array.from({ length: PANEL_INSTRUCTION_COUNTS[kind] }, (_, index) => index + 1);

  return (
    <ol className="space-y-3" data-testid="panel-step-instructions">
      {numbers.map((number) => {
        const image = IMAGES.get(`${kind}-${number}`);
        return (
          <li key={number} className="flex min-w-0 items-start gap-3" data-testid={`panel-step-instruction-${number}`}>
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary-text"
            >
              {number}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-words text-sm leading-relaxed">{t(`onboardingPlan.panel.${kind}.steps.${number}`)}</p>
              {image ? (
                <img
                  src={image}
                  alt={t(`onboardingPlan.panel.${kind}.alts.${number}`)}
                  loading="lazy"
                  className="max-h-60 w-auto max-w-full rounded-md ring-1 ring-inset ring-border"
                  data-testid={`panel-step-image-${number}`}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
