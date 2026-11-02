import { z } from 'zod';
import type { ShowcaseDocument } from '@/types/supplier-showcase';

/**
 * The channel between the editor of the showcase ("Il mio sito vetrina", SP-13c) and the page it shows in an iframe, `postMessage`
 * of the same origin (decision VT-D9: no token, no public endpoint for a draft). The editor sends the draft as it types; the page
 * draws it instead of the published content. Nothing is written and nothing is sent from the page in this mode.
 *
 * The page in the frame of the editor is `/fornitori/:slug/<page>?anteprima=1&frame=1`. The draft never reaches a visitor: the page
 * only listens when it is itself in a frame of the same origin (those two parameters, and a parent window),
 * and it takes a message only from that parent, from its own origin, in the exact shape below. Anything else is dropped.
 */
export const PREVIEW_MESSAGE_TYPE = 'cz-vetrina-preview';
/** What the page says to its parent when it is ready to receive the draft, so the editor can send it at once. */
export const PREVIEW_READY_TYPE = 'cz-vetrina-preview-ready';
export const PREVIEW_SCHEMA_VERSION = 1;

const text = z.string().max(4000).nullish();
const url = z.string().max(2000).nullish();
const items = <T extends z.ZodType>(item: T, max: number) => z.array(item).max(max).optional();

/**
 * The draft: the members of the contract of the content (schemaVersion 1), all optional, text only, and the order of the services to
 * show (slugs; the published page does not carry it, the preview applies it to the services it has). Unknown members are dropped.
 */
const contentSchema = z.object({
  serviceOrder: items(z.string().max(120), 30),
  style: text,
  font: text,
  color: text,
  logo: z.object({ mode: text, url }).nullish(),
  cover: z.object({ url, alt: text }).nullish(),
  tagline: text,
  intro: text,
  bio: text,
  team: items(z.object({ name: text, role: text }), 12),
  values: items(z.string().max(500), 6),
  guarantee: z.object({ title: text, text }).nullish(),
  certs: items(z.object({ label: text, detail: text }), 8),
  faq: items(z.object({ q: text, a: text }), 12),
  gallery: items(z.object({ photoUrl: url, beforeUrl: url, caption: text, place: text, alt: text }), 12),
  prep: items(z.string().max(500), 6),
  sections: z
    .object({
      trust: z.boolean().optional(),
      how: z.boolean().optional(),
      works: z.boolean().optional(),
      zones: z.boolean().optional(),
      certs: z.boolean().optional(),
      faq: z.boolean().optional(),
    })
    .optional(),
});

const messageSchema = z.object({
  type: z.literal(PREVIEW_MESSAGE_TYPE),
  schemaVersion: z.literal(PREVIEW_SCHEMA_VERSION),
  content: contentSchema,
});

/** The message the editor sends: what the page draws instead of the published content. */
export function buildPreviewMessage(content: ShowcaseDocument) {
  return { type: PREVIEW_MESSAGE_TYPE, schemaVersion: PREVIEW_SCHEMA_VERSION, content };
}

/** Who the page is, for deciding whom to believe: its own origin and the window that frames it. */
interface PreviewSelf {
  origin: string;
  parent: unknown;
}

/**
 * The draft carried by a message, or null when the message is not for the page: another origin, another sender than the parent that
 * frames it, a different type or version, or a shape that is not the contract.
 */
export function readPreviewMessage(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, self: PreviewSelf): ShowcaseDocument | null {
  if (event.origin !== self.origin) return null;
  if (event.source !== self.parent) return null;
  const parsed = messageSchema.safeParse(event.data);
  return parsed.success ? parsed.data.content : null;
}

/** What the page says to the editor that frames it: ready for the draft. */
export function buildPreviewReady() {
  return { type: PREVIEW_READY_TYPE, schemaVersion: PREVIEW_SCHEMA_VERSION };
}
