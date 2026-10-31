import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import {
  checkShowcaseFileKind,
  fileProblemMessage,
  isShowcaseImageType,
  prepareShowcaseImage,
  SHOWCASE_MEDIA,
  uploadErrorMessage,
  validateShowcaseFile,
} from '../showcase-media';

const info = (name: string, type: string, size = 1000) => ({ name, type, size });

/** The key itself: the tests read which text was chosen, not what it says. */
const t = (key: string) => key;

function failed(status: number | null, data: unknown = {}): AxiosError {
  const response = status === null ? undefined : ({ status, data, statusText: '', headers: {}, config: {} } as AxiosResponse);
  return new AxiosError('Request failed', status === null ? AxiosError.ERR_NETWORK : AxiosError.ERR_BAD_REQUEST, undefined, undefined, response);
}

describe('The check of a file before it is sent: type and weight (SP-13b)', () => {
  it('accepts a PNG, a JPEG and a WebP, and nothing else, by what the browser calls them', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'IMAGE/JPEG']) expect(isShowcaseImageType(info('foto.bin', type))).toBe(true);
    for (const type of ['image/svg+xml', 'application/pdf', 'image/gif', 'image/heic', 'text/plain']) expect(isShowcaseImageType(info('foto.jpg', type))).toBe(false);
  });

  it('reads the name only when the browser names no type at all (a file dragged from another app)', () => {
    expect(isShowcaseImageType(info('logo.PNG', ''))).toBe(true);
    expect(isShowcaseImageType(info('foto.jpeg', ''))).toBe(true);
    expect(isShowcaseImageType(info('logo.svg', ''))).toBe(false);
    expect(isShowcaseImageType(info('foto', ''))).toBe(false);
  });

  it('refuses an empty file and a file of another type before the weight is looked at', () => {
    expect(checkShowcaseFileKind(info('foto.jpg', 'image/jpeg', 0))).toBe('empty');
    expect(checkShowcaseFileKind(info('logo.svg', 'image/svg+xml', 5_000_000_000))).toBe('type');
    expect(checkShowcaseFileKind(info('foto.jpg', 'image/jpeg', 5_000_000_000))).toBeNull();
  });

  it('allows a logo of 200 KB and a photo of 10 MB, and not a byte more', () => {
    expect(validateShowcaseFile(info('logo.png', 'image/png', SHOWCASE_MEDIA.logoMaxBytes), 'logo')).toBeNull();
    expect(validateShowcaseFile(info('logo.png', 'image/png', SHOWCASE_MEDIA.logoMaxBytes + 1), 'logo')).toBe('tooLarge');
    for (const kind of ['cover', 'work', 'before'] as const) {
      expect(validateShowcaseFile(info('foto.jpg', 'image/jpeg', SHOWCASE_MEDIA.photoMaxBytes), kind)).toBeNull();
      expect(validateShowcaseFile(info('foto.jpg', 'image/jpeg', SHOWCASE_MEDIA.photoMaxBytes + 1), kind)).toBe('tooLarge');
    }
  });

  it('says why in words, with the limit of the kind', () => {
    expect(fileProblemMessage('empty', 'cover', t)).toBe('supplier.showcase.media.errors.empty');
    expect(fileProblemMessage('type', 'cover', t)).toBe('supplier.showcase.media.errors.unsupportedType');
    expect(fileProblemMessage('tooLarge', 'logo', t)).toBe('supplier.showcase.media.errors.tooLarge');
  });
});

describe('The text of a failed upload: never a generic one when the server said what is wrong', () => {
  it('maps 413, 415 and the three 422 of the images to their own texts', () => {
    expect(uploadErrorMessage(failed(413), 'work', t)).toBe('supplier.showcase.media.errors.tooLarge');
    expect(uploadErrorMessage(failed(415), 'work', t)).toBe('supplier.showcase.media.errors.unsupportedType');
    expect(uploadErrorMessage(failed(422, { code: 'showcase_media_invalid_image' }), 'work', t)).toBe('supplier.showcase.media.errors.invalidImage');
    expect(uploadErrorMessage(failed(422, { code: 'showcase_media_dimensions' }), 'work', t)).toBe('supplier.showcase.media.errors.dimensions');
    expect(uploadErrorMessage(failed(422, { code: 'showcase_media_limit_reached' }), 'work', t)).toBe('supplier.showcase.media.errors.limitReached');
  });

  it('says the network is down when there was no answer, and uses the generic text only when nothing else can be said', () => {
    expect(uploadErrorMessage(failed(null), 'work', t)).toBe('apiErrors.network');
    expect(uploadErrorMessage(failed(500), 'work', t)).toBe('supplier.showcase.media.errors.failed');
  });
});

describe('Making a photo smaller before it is sent', () => {
  it('sends a light photo and a small logo as they are', async () => {
    const photo = new File([new Uint8Array(1024)], 'foto.jpg', { type: 'image/jpeg' });
    const logo = new File([new Uint8Array(1024)], 'logo.png', { type: 'image/png' });

    expect(await prepareShowcaseImage(photo, 'work')).toBe(photo);
    expect(await prepareShowcaseImage(logo, 'logo')).toBe(logo);
  });

  it('leaves a heavy file as it is when the browser cannot decode it (the server has the last word)', async () => {
    const heavy = new File([new Uint8Array(2 * 1024 * 1024)], 'foto.jpg', { type: 'image/jpeg' });

    // There is no image decoder in the test environment: the file comes back untouched.
    expect(await prepareShowcaseImage(heavy, 'cover')).toBe(heavy);
  });
});
