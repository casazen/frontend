import { overlayOf } from '../lib/document-guidance';

/**
 * Synthetic frames of a card in front of a camera, for the tests of the live guidance of the document camera (E71/F02/US01/T01): pixels made by hand, so that every check is proved on
 * a picture whose faults are known (no photo of a person or of a document is ever in the repository).
 */
export interface SyntheticFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface FrameOptions {
  width?: number;
  height?: number;
  background?: number;
  card?: number;
  texture?: number;
  /** Where the card is, in the pixels of the frame: by default exactly on the outline of the overlay, so that its four edges are where the guide looks for them. */
  cardRect?: { left: number; top: number; width: number; height: number };
  glare?: number;
}

/** A frame of a card that is well framed, well lit and sharp unless an option says otherwise. */
export function makeFrame(options: FrameOptions = {}): SyntheticFrame {
  const { width = 480, height = 270, background = 60, card = 170, texture = 45, glare = 0 } = options;
  const outline = overlayOf(width, height);
  const rect = options.cardRect ?? outline;
  const left = Math.round(rect.left);
  const top = Math.round(rect.top);
  const right = Math.round(rect.left + rect.width);
  const bottom = Math.round(rect.top + rect.height);
  const glareBottom = Math.round(outline.top + outline.height * glare);

  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let gray = background;
      if (x >= left && x < right && y >= top && y < bottom) {
        gray = ((x >> 1) + (y >> 1)) % 2 === 0 ? card + texture : card - texture;
        if (glare > 0 && y < glareBottom) gray = 255;
      }
      const at = (y * width + x) * 4;
      data[at] = gray;
      data[at + 1] = gray;
      data[at + 2] = gray;
      data[at + 3] = 255;
    }
  }
  return { width, height, data };
}

export const goodFrame = (): SyntheticFrame => makeFrame();

export const darkFrame = (): SyntheticFrame => makeFrame({ background: 8, card: 40, texture: 6 });

export const brightFrame = (): SyntheticFrame => makeFrame({ background: 225, card: 238, texture: 8 });

export const glareFrame = (): SyntheticFrame => makeFrame({ glare: 0.15 });

export const blurredFrame = (): SyntheticFrame => makeFrame({ texture: 0 });

export const farFrame = (): SyntheticFrame => {
  const outline = overlayOf(480, 270);
  const inset = 0.2;
  return makeFrame({
    cardRect: {
      left: outline.left + outline.width * inset,
      top: outline.top + outline.height * inset,
      width: outline.width * (1 - 2 * inset),
      height: outline.height * (1 - 2 * inset),
    },
  });
};

export const uprightFrame = (): SyntheticFrame => makeFrame({ width: 270, height: 480 });
