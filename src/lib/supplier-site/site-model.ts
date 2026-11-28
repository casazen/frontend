import type {
  PublicShowcaseSections,
  PublicSupplierService,
  SupplierShowcaseDto,
} from '@/api/public-supplier.api';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import {
  resolveSiteFont,
  resolveSiteStyle,
  siteButtonColor,
  SITE_STYLES,
  type HeroLayout,
  type SiteFontId,
  type SiteStyleId,
} from './style-config';

export interface SiteTrustItem {
  kind: 'verified' | 'jobs' | 'response' | 'payments';
  count?: number;
  minutes?: number;
}

export type SiteLogoMode = 'mark' | 'text' | 'image';

export interface SiteWork {
  photoUrl: string;
  beforeUrl: string | null;
  caption: string;
  place: string;
  alt: string;
}

export interface SiteFirstSlot {
  service: PublicSupplierService;
  startUtc: string;
}

export interface SiteBlocks {
  trust: boolean;
  services: boolean;
  categories: boolean;
  how: boolean;
  about: boolean;
  aboutPage: boolean;
  works: boolean;
  zones: boolean;
  certs: boolean;
  faq: boolean;
  days: boolean;
  closing: boolean;
}

export interface SiteModel {
  slug: string;
  name: string;
  style: SiteStyleId;
  font: SiteFontId;
  hero: HeroLayout;
  buttonColor: string | null;
  categories: string[];
  comuni: string[];
  tagline: string | null;
  intro: string | null;
  bio: string | null;
  coverUrl: string | null;
  coverAlt: string;
  logo: { mode: SiteLogoMode; url: string | null };
  sections: PublicShowcaseSections;
  paused: boolean;
  bookingsOpen: boolean;
  /** Published, not paused, and the server says the bookings are closed: the page says so instead of staying silent. */
  bookingsClosed: boolean;
  services: PublicSupplierService[] | null;
  firstSlot: SiteFirstSlot | null;
  trust: SiteTrustItem[];
  heroTrust: SiteTrustItem | null;
  respondWithinMinutes: number | null;
  works: SiteWork[];
  photos: string[];
  values: string[];
  guarantee: { title: string | null; text: string | null } | null;
  certs: { label: string; detail: string | null }[];
  faq: { question: string; answer: string }[];
  team: { name: string; role: string | null }[];
  prep: string[];
  availability: { date: string; available: boolean }[];
  blocks: SiteBlocks;
}

const EMPTY_SECTIONS: PublicShowcaseSections = { trust: true, how: true, works: true, zones: true, certs: true, faq: true };

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function texts(values: readonly (string | null | undefined)[] | undefined): string[] {
  return (values ?? []).map(text).filter((value): value is string => value !== null);
}

function logoOf(content: SupplierShowcaseDto['content']): SiteModel['logo'] {
  const mode = content?.logo?.mode;
  const url = content?.logo?.url;
  if (mode === 'image' && isDisplayableMediaUrl(url)) return { mode: 'image', url };
  if (mode === 'text') return { mode: 'text', url: null };
  return { mode: 'mark', url: null };
}

function firstSlotOf(services: PublicSupplierService[] | null): SiteFirstSlot | null {
  let best: SiteFirstSlot | null = null;
  for (const service of services ?? []) {
    const start = service.nextSlotUtc;
    if (!start || Number.isNaN(new Date(start).getTime())) continue;
    if (!best || new Date(start).getTime() < new Date(best.startUtc).getTime()) best = { service, startUtc: start };
  }
  return best;
}

export function applyServiceOrder(services: PublicSupplierService[], order: readonly string[] | undefined): PublicSupplierService[] {
  if (!order || order.length === 0) return services;
  const bySlug = new Map(services.map((service) => [service.slug, service]));
  const ordered: PublicSupplierService[] = [];
  for (const slug of order) {
    const service = bySlug.get(slug);
    if (service && !ordered.includes(service)) ordered.push(service);
  }
  return ordered.length > 0 ? ordered : services;
}

function trustOf(dto: SupplierShowcaseDto): SiteTrustItem[] {
  const items: SiteTrustItem[] = [];
  if (dto.trust?.verified === true) items.push({ kind: 'verified' });
  const jobs = dto.trust?.jobsDone;
  if (typeof jobs === 'number' && jobs > 0) items.push({ kind: 'jobs', count: jobs });
  const minutes = dto.medianResponseMinutes;
  if (typeof minutes === 'number' && minutes > 0) items.push({ kind: 'response', minutes });
  if (dto.acceptsOnlinePayments === true) items.push({ kind: 'payments' });
  return items;
}

export function buildSiteModel(dto: SupplierShowcaseDto): SiteModel {
  const content = dto.content;
  const categories = dto.categories ?? [];
  const style = resolveSiteStyle(content?.style, categories);
  const font = resolveSiteFont(content?.font, style);
  const name = dto.legalName;

  const profilePhotos = (dto.photoUrls ?? []).filter(isDisplayableMediaUrl);
  const coverFromContent = content?.cover?.url;
  const coverUrl = isDisplayableMediaUrl(coverFromContent) ? coverFromContent : (profilePhotos[0] ?? null);

  const paused = dto.paused === true;
  const services = dto.services ? dto.services.filter((service) => service.slug && service.name) : null;
  const trust = trustOf(dto);

  const guarantee = content?.guarantee
    ? { title: text(content.guarantee.title), text: text(content.guarantee.text) }
    : null;

  const sections: PublicShowcaseSections = { ...EMPTY_SECTIONS, ...content?.sections };
  const bookingsOpen = dto.bookingsOpen === true && !paused;
  const comuni = texts(dto.comuni);
  const bio = text(content?.bio) ?? text(dto.bio);
  const values = texts(content?.values);
  const works = (content?.gallery ?? []).flatMap((work): SiteWork[] => {
    if (!isDisplayableMediaUrl(work.photoUrl)) return [];
    const caption = text(work.caption) ?? '';
    return [
      {
        photoUrl: work.photoUrl,
        beforeUrl: isDisplayableMediaUrl(work.beforeUrl) ? work.beforeUrl : null,
        caption,
        place: text(work.place) ?? '',
        alt: text(work.alt) ?? (caption || name),
      },
    ];
  });
  const certs = (content?.certs ?? []).flatMap((cert) => {
    const label = text(cert.label);
    return label ? [{ label, detail: text(cert.detail) }] : [];
  });
  const faq = (content?.faq ?? []).flatMap((row) => {
    const question = text(row.q);
    const answer = text(row.a);
    return question && answer ? [{ question, answer }] : [];
  });
  const keptGuarantee = guarantee && (guarantee.title || guarantee.text) ? guarantee : null;
  const team = (content?.team ?? []).flatMap((member) => {
    const memberName = text(member.name);
    return memberName ? [{ name: memberName, role: text(member.role) }] : [];
  });

  return {
    slug: dto.slug ?? '',
    name,
    style,
    font,
    hero: SITE_STYLES[style].hero,
    buttonColor: siteButtonColor(content?.color),
    categories,
    comuni,
    tagline: text(content?.tagline),
    intro: text(content?.intro),
    bio,
    coverUrl,
    coverAlt: text(content?.cover?.alt) ?? name,
    logo: logoOf(content),
    sections,
    paused,
    bookingsOpen,
    bookingsClosed: dto.bookingsOpen === false && !paused,
    services,
    firstSlot: bookingsOpen ? firstSlotOf(services) : null,
    trust,
    heroTrust: trust.find((item) => item.kind === 'verified' || item.kind === 'jobs') ?? null,
    respondWithinMinutes:
      typeof dto.respondWithinMinutes === 'number' && dto.respondWithinMinutes > 0 ? dto.respondWithinMinutes : null,
    works,
    photos: profilePhotos,
    values,
    guarantee: keptGuarantee,
    certs,
    faq,
    team,
    prep: texts(content?.prep),
    availability: dto.availability ?? [],
    blocks: {
      trust: sections.trust && trust.length > 0,
      services: services !== null && services.length > 0,
      categories: services === null && categories.length > 0,
      how: sections.how && bookingsOpen,
      about: bio !== null || values.length > 0,
      aboutPage: bio !== null || values.length > 0 || team.length > 0 || keptGuarantee !== null || certs.length > 0,
      works: sections.works && (works.length > 0 || profilePhotos.length > 0),
      zones: sections.zones && comuni.length > 0,
      certs: sections.certs && (keptGuarantee !== null || certs.length > 0),
      faq: sections.faq && faq.length > 0,
      days: services === null && (dto.availability ?? []).some((day) => day.available),
      closing: bookingsOpen,
    },
  };
}
