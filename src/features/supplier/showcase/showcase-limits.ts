/**
 * How much each member of the content may hold: the bounds of the server (`ShowcaseContentLimits`, SP-13a). The ones the design states
 * (the sentence, the introduction, "chi siamo", the guarantee, the captions) are the counters of the editor; one place, so the fields
 * and the server cannot drift apart.
 */
export const SHOWCASE_LIMITS = {
  tagline: 90,
  intro: 180,
  bio: 700,
  team: { items: 12, name: 60, role: 60 },
  values: { items: 6, text: 100 },
  guarantee: { title: 60, text: 160 },
  certs: { items: 8, label: 80, detail: 160 },
  faq: { items: 12, question: 120, answer: 600 },
  gallery: { items: 12, caption: 70, place: 40, alt: 120 },
  prep: { items: 6, text: 160 },
} as const;
