import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canvasToJpeg,
  DOCUMENT_JPEG_QUALITY,
  DOCUMENT_MAX_WIDTH,
  fitWidth,
  IMAGE_SEND_AS_IS_BYTES,
  prepareDocumentPhoto,
  SELFIE_JPEG_QUALITY,
  SELFIE_MAX_WIDTH,
} from '../image-capture';

interface Encoded {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  type: string | undefined;
  quality: unknown;
}

let encoded: Encoded[] = [];

function stubCanvas(blobOf: (type: string | undefined) => Blob | null = (type) => new Blob(['jpeg'], { type })) {
  encoded = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillRect: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type, quality) {
    encoded.push({ canvas: this, width: this.width, height: this.height, type, quality });
    callback(blobOf(type));
  });
}

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fitWidth', () => {
  it('fitWidth_WiderThanTheLimit_IsScaledDownKeepingTheProportions', () => {
    expect(fitWidth(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWidth(3840, 2160, 1920)).toEqual({ width: 1920, height: 1080 });
  });

  it('fitWidth_NotWiderThanTheLimit_IsNeverScaledUp', () => {
    expect(fitWidth(640, 480, 1920)).toEqual({ width: 640, height: 480 });
    expect(fitWidth(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 });
  });

  it('fitWidth_AHeightThatRoundsToZero_StaysAtLeastOnePixel', () => {
    expect(fitWidth(100_000, 10, 1920).height).toBe(1);
  });
});

describe('canvasToJpeg (ADR-013-R12)', () => {
  beforeEach(() => stubCanvas());

  it('canvasToJpeg_AWideSelfie_IsAtMost1920WideAJpegAt80Percent', async () => {
    const blob = await canvasToJpeg(canvasOf(4000, 3000));

    expect(blob.type).toBe('image/jpeg');
    expect(SELFIE_MAX_WIDTH).toBe(1920);
    expect(SELFIE_JPEG_QUALITY).toBe(0.8);
    expect(encoded).toHaveLength(1);
    expect(encoded[0]).toMatchObject({ width: 1920, height: 1440, type: 'image/jpeg', quality: 0.8 });
  });

  it('canvasToJpeg_ASmallPicture_KeepsItsSize', async () => {
    await canvasToJpeg(canvasOf(640, 480));

    expect(encoded[0]).toMatchObject({ width: 640, height: 480 });
  });

  it('canvasToJpeg_AfterTheEncoding_TheCanvasItDrewOnIsEmptied', async () => {
    await canvasToJpeg(canvasOf(1280, 720));

    expect(encoded[0].canvas.width).toBe(0);
    expect(encoded[0].canvas.height).toBe(0);
  });

  it('canvasToJpeg_AnEmptyCanvas_Rejects', async () => {
    await expect(canvasToJpeg(canvasOf(0, 0))).rejects.toThrow();
  });

  it('canvasToJpeg_TheBrowserCannotEncode_RejectsAndStillEmptiesTheCanvas', async () => {
    vi.restoreAllMocks();
    stubCanvas(() => null);

    await expect(canvasToJpeg(canvasOf(800, 600))).rejects.toThrow();
    expect(encoded[0].canvas.width).toBe(0);
  });
});

describe('prepareDocumentPhoto', () => {
  const file = (size: number, type: string, name = 'document') => {
    const photo = new File(['x'], name, { type });
    Object.defineProperty(photo, 'size', { value: size });
    return photo;
  };

  it.each(['image/jpeg', 'image/png'])('prepareDocumentPhoto_A%sUnderTheLimit_IsSentAsItIsNothingIsRedrawn', async (type) => {
    stubCanvas();
    const photo = file(3_000_000, type);

    const prepared = await prepareDocumentPhoto(photo);

    expect(prepared).toEqual({ ok: true, blob: photo });
    expect(encoded).toHaveLength(0);
  });

  it('prepareDocumentPhoto_AJpegOverTheLimitAndABrowserThatCannotRedrawIt_IsTooLarge', async () => {
    vi.stubGlobal('createImageBitmap', undefined);

    expect(await prepareDocumentPhoto(file(IMAGE_SEND_AS_IS_BYTES + 1, 'image/jpeg'))).toEqual({ ok: false, problem: 'too_large' });
  });

  it('prepareDocumentPhoto_ATypeTheApiDoesNotReadAndABrowserThatCannotDecodeIt_IsUnsupported', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('cannot decode')));

    expect(await prepareDocumentPhoto(file(2_000_000, 'image/heic'))).toEqual({ ok: false, problem: 'unsupported' });
  });

  it('prepareDocumentPhoto_AHeavyPhoto_IsRedrawnAsAJpegNoWiderThanTheLimit', async () => {
    stubCanvas();
    const bitmap = { width: 6000, height: 4000, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));

    const prepared = await prepareDocumentPhoto(file(IMAGE_SEND_AS_IS_BYTES + 1_000_000, 'image/jpeg'));

    expect(prepared.ok).toBe(true);
    expect(encoded[0]).toMatchObject({ width: DOCUMENT_MAX_WIDTH, height: 1707, type: 'image/jpeg', quality: DOCUMENT_JPEG_QUALITY });
    expect(bitmap.close).toHaveBeenCalled();
    expect(encoded[0].canvas.width).toBe(0);
  });

  it('prepareDocumentPhoto_ARedrawnPhotoThatIsStillTooHeavy_IsTooLarge', async () => {
    stubCanvas(() => {
      const heavy = new Blob(['x'], { type: 'image/jpeg' });
      Object.defineProperty(heavy, 'size', { value: IMAGE_SEND_AS_IS_BYTES + 1 });
      return heavy;
    });
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 3000, height: 2000, close: vi.fn() }));

    expect(await prepareDocumentPhoto(file(IMAGE_SEND_AS_IS_BYTES + 1, 'image/png'))).toEqual({ ok: false, problem: 'too_large' });
  });
});
