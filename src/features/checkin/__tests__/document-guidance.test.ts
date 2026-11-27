import { describe, expect, it } from 'vitest';
import {
  assessFrame,
  FIRST_HINT,
  GUIDE_CHECKS,
  GUIDE_RULES_VERSION,
  GUIDE_STEADY_MS,
  GUIDE_WORKING_SIDE,
  ID1_CARD_RATIO,
  isSteady,
  nextHint,
  overlayOf,
  steadySince,
  workingSizeOf,
  type GuideHint,
} from '../lib/document-guidance';
import { blurredFrame, brightFrame, darkFrame, farFrame, glareFrame, goodFrame, makeFrame, uprightFrame } from './document-frames';

describe('overlayOf: the outline of an ID-1 card', () => {
  it.each([
    [1280, 720],
    [640, 480],
    [1920, 1080],
    [720, 1280],
  ])('overlayOf_Frame%ix%i_HasTheProportionsOfAnId1CardAndIsCentredInsideTheFrame', (width, height) => {
    const outline = overlayOf(width, height);

    expect(outline.width / outline.height).toBeCloseTo(ID1_CARD_RATIO, 5);
    expect(outline.left).toBeGreaterThan(0);
    expect(outline.top).toBeGreaterThan(0);
    expect(outline.left + outline.width).toBeLessThan(width);
    expect(outline.top + outline.height).toBeLessThan(height);
    expect(outline.left + outline.width / 2).toBeCloseTo(width / 2, 5);
    expect(outline.top + outline.height / 2).toBeCloseTo(height / 2, 5);
  });

  it('ID1_CARD_RATIO_Is85_60By53_98_AsAConstantThatIsNotADecision', () => {
    expect(ID1_CARD_RATIO).toBeCloseTo(85.6 / 53.98, 10);
  });

  it('workingSizeOf_ALargeFrame_KeepsTheProportionsWithTheLongestSideAtTheWorkingSide', () => {
    expect(workingSizeOf(1920, 1080)).toEqual({ width: GUIDE_WORKING_SIDE, height: 270 });
    expect(workingSizeOf(1080, 1920)).toEqual({ width: 270, height: GUIDE_WORKING_SIDE });
  });

  it('workingSizeOf_ASmallFrame_IsNeverEnlarged', () => {
    expect(workingSizeOf(320, 240)).toEqual({ width: 320, height: 240 });
  });
});

describe('assessFrame: what the live guidance finds wrong', () => {
  it('assessFrame_ACardOnTheOutlineWellLitAndSharp_PassesEveryCheck', () => {
    const report = assessFrame(goodFrame());

    expect(report.failing).toEqual([]);
    expect(report.first).toBeNull();
    expect(report.metrics.meanLuminance).toBeGreaterThan(55);
    expect(report.metrics.meanLuminance).toBeLessThan(210);
    expect(Object.values(report.metrics.edgeShares).every((share) => share > 0.9)).toBe(true);
  });

  it('assessFrame_ATooDarkPicture_SaysDark', () => {
    const report = assessFrame(darkFrame());

    expect(report.first).toBe('dark');
    expect(report.failing).toContain('dark');
    expect(report.failing).not.toContain('bright');
    expect(report.metrics.meanLuminance).toBeLessThan(55);
  });

  it('assessFrame_ATooBrightPicture_SaysBright', () => {
    const report = assessFrame(brightFrame());

    expect(report.first).toBe('bright');
    expect(report.failing).toContain('bright');
    expect(report.failing).not.toContain('dark');
    expect(report.metrics.meanLuminance).toBeGreaterThan(210);
  });

  it('assessFrame_AReflectionOverTheOutline_SaysGlareAndNothingElse', () => {
    const report = assessFrame(glareFrame());

    expect(report.failing).toEqual(['glare']);
    expect(report.metrics.glareShare).toBeGreaterThan(0.08);
  });

  it('assessFrame_ACardWithNoDetail_SaysBlurAndNothingElse', () => {
    const report = assessFrame(blurredFrame());

    expect(report.failing).toEqual(['blur']);
    expect(report.metrics.sharpness).toBeLessThan(40);
    // The same frame with its detail is sharp: the check tells the two apart.
    expect(assessFrame(goodFrame()).metrics.sharpness).toBeGreaterThan(report.metrics.sharpness);
  });

  it('assessFrame_ACardThatDoesNotFillTheOutline_SaysEdgesBecauseNoBorderHasAnEdge', () => {
    const report = assessFrame(farFrame());

    expect(report.first).toBe('edges');
    expect(Object.values(report.metrics.edgeShares).every((share) => share < 0.5)).toBe(true);
  });

  it('assessFrame_AMissingSideOfTheCard_IsAnEdgeThatFailsAlone', () => {
    // The card stops short of the outline on the right: only the right border has no edge.
    const outline = overlayOf(480, 270);
    const report = assessFrame(makeFrame({ cardRect: { left: outline.left, top: outline.top, width: outline.width * 0.7, height: outline.height } }));

    expect(report.failing).toEqual(['edges']);
    expect(report.metrics.edgeShares.right).toBeLessThan(0.5);
    expect(report.metrics.edgeShares.left).toBeGreaterThan(0.9);
    expect(report.metrics.edgeShares.top).toBeGreaterThan(0.5);
  });

  it('assessFrame_APhoneHeldUpright_SaysOrientationFirst', () => {
    const report = assessFrame(uprightFrame());

    expect(report.first).toBe('orientation');
    expect(report.failing).toEqual(['orientation']);
  });

  it('assessFrame_SeveralFaults_AreListedInTheOrderOfTheHintsAndTheFirstIsTheOneSaid', () => {
    // Upright and dark: the phone has to be turned before anything else matters.
    const report = assessFrame(makeFrame({ width: 270, height: 480, background: 8, card: 40, texture: 6 }));

    expect(report.first).toBe('orientation');
    expect(report.failing.indexOf('orientation')).toBeLessThan(report.failing.indexOf('dark'));
    expect([...report.failing].sort((a, b) => GUIDE_CHECKS.indexOf(a) - GUIDE_CHECKS.indexOf(b))).toEqual(report.failing);
  });

  it('assessFrame_AFrameWithNothingToLookAt_DoesNotThrowAndIsNeverAPass', () => {
    expect(assessFrame({ width: 0, height: 0, data: new Uint8ClampedArray(0) }).first).not.toBeNull();
    expect(assessFrame({ width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) }).first).not.toBeNull();
    // Pixels missing from the data: not a frame either.
    expect(assessFrame({ width: 480, height: 270, data: new Uint8ClampedArray(100) }).first).not.toBeNull();
  });

  it('assessFrame_TheSameFrameTwice_GivesTheSameReport', () => {
    expect(assessFrame(glareFrame())).toEqual(assessFrame(glareFrame()));
  });

  it('GUIDE_RULES_VERSION_IsNamedSoThatAChangeOfTheValuesIsANewVersion', () => {
    expect(GUIDE_RULES_VERSION).toMatch(/^document-guide-\d{4}\.\d{2}-\d+$/);
  });
});

describe('steadiness: the button wakes up after half a second of passes', () => {
  it('steadySince_AFirstPass_StartsTheWaitAndAFailEndsIt', () => {
    expect(steadySince(null, true, 1_000)).toBe(1_000);
    expect(steadySince(1_000, true, 1_300)).toBe(1_000);
    expect(steadySince(1_000, false, 1_300)).toBeNull();
    expect(steadySince(null, false, 1_300)).toBeNull();
  });

  it('isSteady_AfterTheStepOfHalfASecond_IsTrueAndNotBefore', () => {
    expect(GUIDE_STEADY_MS).toBe(500);
    expect(isSteady(null, 10_000)).toBe(false);
    expect(isSteady(1_000, 1_499)).toBe(false);
    expect(isSteady(1_000, 1_500)).toBe(true);
    expect(isSteady(1_000, 9_000)).toBe(true);
  });

  it('steadiness_AFailInTheMiddle_StartsTheHalfSecondAgain', () => {
    let since = steadySince(null, true, 0);
    since = steadySince(since, true, 300);
    since = steadySince(since, false, 400);
    since = steadySince(since, true, 500);

    expect(isSteady(since, 900)).toBe(false);
    expect(isSteady(since, 1_000)).toBe(true);
  });
});

describe('nextHint: a hint changes only when it has been wanted twice in a row', () => {
  const feed = (wanted: readonly GuideHint[]) => wanted.reduce(nextHint, FIRST_HINT);

  it('nextHint_AHintWantedOnce_DoesNotReplaceTheOneOnTheScreen', () => {
    expect(feed(['edges']).shown).toBe('waiting');
  });

  it('nextHint_AHintWantedTwiceInARow_ReplacesIt', () => {
    expect(feed(['edges', 'edges']).shown).toBe('edges');
  });

  it('nextHint_AFlickerBetweenTwoHints_KeepsTheOneThatWasShown', () => {
    expect(feed(['blur', 'blur', 'ready', 'blur', 'ready', 'blur']).shown).toBe('blur');
  });

  it('nextHint_TheHintThatIsAlreadyShown_ForgetsAPendingOne', () => {
    const state = feed(['blur', 'blur', 'ready', 'blur']);

    expect(state).toEqual({ shown: 'blur', candidate: null, seen: 0 });
  });
});
