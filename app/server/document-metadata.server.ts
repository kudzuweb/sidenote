import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

type DomLikeDocument = {
  querySelectorAll: (selectors: string) => Iterable<Element>;
};

const AUTHOR_META_SELECTORS = [
  'meta[name="author"]',
  'meta[name="authors"]',
  'meta[name="byl"]',
  'meta[name="byline"]',
  'meta[name="dc.creator"]',
  'meta[name="dc.creator.author"]',
  'meta[name="dc.contributor"]',
  'meta[name="sailthru.author"]',
  'meta[name="parsely-author"]',
  'meta[property="article:author"]',
  'meta[property="byline"]',
  'meta[property="twitter:data1"]',
  '[itemprop="author"]',
];

const DATE_META_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[property="article:modified_time"]',
  'meta[property="og:published_time"]',
  'meta[property="og:updated_time"]',
  'meta[name="pubdate"]',
  'meta[name="publish-date"]',
  'meta[name="publish_time"]',
  'meta[name="date"]',
  'meta[name="dc.date"]',
  'meta[name="dc.date.issued"]',
  'meta[name="dcterms.created"]',
  'meta[name="datePublished"]',
  '[itemprop="datePublished"]',
  'time[datetime]',
];

const STOPWORD_AUTHORS = new Set([
  "ap",
  "associated press",
  "reuters",
  "staff",
  "staff writer",
  "staff writers",
  "editorial board",
  "editors",
  "correspondent",
  "contributors",
  "news service",
  "news desk",
  "press release",
]);

const metadataSchema = z.object({
  authors: z.array(z.string().trim().min(2)).max(8).optional().nullable(),
  publishedDate: z.string().trim().min(4).optional().nullable(),
  title: z.string().trim().min(4).optional().nullable(),
});

export type CollectedMetadata = {
  authors: string[];
  publishedTimes: string[];
  raw: Record<string, string>;
};

export type MetadataResolutionInput = {
  url: string;
  title: string | null;
  byline?: string | null;
  textContent?: string | null;
  publishedTime?: string | null;
  meta: CollectedMetadata;
};

export type ResolvedMetadata = {
  authors: string[];
  publishedAt: string | null;
  title: string | null;
};

const dedupe = (values: Iterable<string>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const stripBylinePrefixes = (value: string) => value.replace(/^\s*(by|from|article by)\s+/i, "").trim();

const sanitizeAuthorCandidate = (raw: string) => {
  const cleaned = normalizeWhitespace(stripBylinePrefixes(raw))
    .replace(/[-–—]\s*$/, "")
    .replace(/\b(staff|reporting|reports|analysis)\b/gi, "")
    .replace(/\bfor\s+.+$/i, "")
    .replace(/\b[A-Z]{2,}\b/g, match => (match.length <= 3 ? match : match.charAt(0) + match.slice(1).toLowerCase()))
    .trim();

  if (!cleaned) return null;
  if (STOPWORD_AUTHORS.has(cleaned.toLowerCase())) return null;
  if (cleaned.length < 2) return null;
  if (!/[a-z]/i.test(cleaned)) return null;
  if (/\d/.test(cleaned)) return null;
  return cleaned;
};

export const parseAuthorNames = (source: string | null | undefined): string[] => {
  if (!source) return [];
  const cleaned = normalizeWhitespace(source);
  if (!cleaned) return [];

  const parts = cleaned
    .split(/(?:\s+(?:and|&)\s+|,|;|\/|\||(?:\s+with\s+))/i)
    .map(fragment => {
      const trimmed = fragment.replace(/^[–—-]\s*/, "");
      return sanitizeAuthorCandidate(trimmed);
    })
    .filter((name): name is string => Boolean(name));

  return dedupe(parts);
};

const collectMetaContents = (root: DomLikeDocument, selectors: string[]) => {
  const values: string[] = [];
  for (const selector of selectors) {
    const nodes = root.querySelectorAll(selector);
    for (const node of nodes) {
      const element = node as HTMLElement & { getAttribute?: (attr: string) => string | null };
      let value: string | null = null;
      if (element.tagName?.toLowerCase() === "time" && "dateTime" in element) {
        value = (element as HTMLTimeElement).dateTime || element.textContent;
      } else if (element.getAttribute) {
        value = element.getAttribute("content") ?? element.getAttribute("value") ?? element.textContent;
      } else {
        value = element.textContent;
      }
      if (!value) continue;
      const normalized = normalizeWhitespace(value);
      if (!normalized) continue;
      values.push(normalized);
    }
  }
  return dedupe(values);
};

export const collectDocumentMetadata = (doc: DomLikeDocument): CollectedMetadata => {
  const authors = collectMetaContents(doc, AUTHOR_META_SELECTORS);
  const publishedTimes = collectMetaContents(doc, DATE_META_SELECTORS);
  const raw: Record<string, string> = {};

  authors.forEach((author, index) => {
    raw[`meta_author_${index}`] = author;
  });
  publishedTimes.forEach((date, index) => {
    raw[`meta_published_${index}`] = date;
  });

  return {
    authors,
    publishedTimes,
    raw,
  };
};

const normalizeDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const iso = new Date(parsed).toISOString();
    if (iso.startsWith("1970")) return trimmed;
    return iso;
  }
  const match = trimmed.match(/(\d{4}-\d{2}-\d{2})(?:[ t](\d{2}:\d{2}(?::\d{2})?)?(?:([+-]\d{2}:?\d{2}|z))?)?/i);
  if (match) {
    const [_, date, time, zone] = match;
    const iso = `${date}${time ? `T${time}` : "T00:00:00"}${zone ? zone.toUpperCase().replace(/(?<=\d)(?=\d{2}$)/, ":") : "Z"}`;
    return iso;
  }
  return trimmed;
};

const mergeAuthors = (...candidateLists: Array<string[]>) => {
  const combined: string[] = [];
  for (const list of candidateLists) {
    for (const author of list) {
      const normalized = sanitizeAuthorCandidate(author);
      if (!normalized) continue;
      combined.push(normalized);
    }
  }
  return dedupe(combined);
};

const resolvePublishedTime = (candidates: string[]) => {
  for (const candidate of candidates) {
    const normalized = normalizeDate(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const inferMetadataWithLLM = async (
  input: MetadataResolutionInput
): Promise<Partial<ResolvedMetadata> | null> => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const snippet = (() => {
    if (!input.textContent) return "";
    const paragraphs = input.textContent
      .split(/\n{2,}|\r?\n\r?\n/)
      .map(section => normalizeWhitespace(section))
      .filter(Boolean)
      .slice(0, 3);
    return paragraphs.join("\n\n").slice(0, 1800);
  })();

  const metaSummary = Object.entries(input.meta.raw)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const prompt = [
    "You are helping normalize article metadata for a knowledge base.",
    "Use the provided context to decide the most likely author names and publication date.",
    "Return null when uncertain. Prefer ISO 8601 (YYYY-MM-DD or full timestamp) when possible.",
    "Limit authors to the primary credited people.",
    "",
    `URL: ${input.url}`,
    input.title ? `Title: ${input.title}` : "",
    input.byline ? `Byline: ${input.byline}` : "",
    input.publishedTime ? `Existing published time: ${input.publishedTime}` : "",
    metaSummary ? `Meta tags:\n${metaSummary}` : "",
    snippet ? `Excerpt:\n${snippet}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: metadataSchema,
      prompt,
      maxTokens: 256,
    });
    if (!object) return null;
    const authors = object.authors ? mergeAuthors(object.authors) : [];
    const publishedAt = object.publishedDate ? normalizeDate(object.publishedDate) : null;
    const title = object.title ? normalizeWhitespace(object.title) : null;
    return {
      authors,
      publishedAt,
      title,
    };
  } catch (error) {
    console.warn("[document-metadata] metadata inference failed", error);
    return null;
  }
};

export const resolveDocumentMetadata = async (
  input: MetadataResolutionInput
): Promise<ResolvedMetadata> => {
  const llmResult = await inferMetadataWithLLM(input);
  const bylineAuthors = parseAuthorNames(input.byline);
  const metaAuthors = (input.meta?.authors ?? []).flatMap(name => parseAuthorNames(name));
  const llmAuthors = llmResult?.authors ?? [];
  const authors = mergeAuthors(llmAuthors, bylineAuthors, metaAuthors);

  const publishedCandidates: string[] = [];
  if (llmResult?.publishedAt) publishedCandidates.push(llmResult.publishedAt);
  if (input.publishedTime) publishedCandidates.push(input.publishedTime);
  if (input.meta?.publishedTimes?.length) {
    publishedCandidates.push(...input.meta.publishedTimes);
  }
  const publishedAt = resolvePublishedTime(publishedCandidates);

  const titleCandidates: Array<string | null | undefined> = [
    llmResult?.title,
    input.title,
  ];
  const title =
    titleCandidates
      .map(candidate => (candidate ? normalizeWhitespace(candidate) : null))
      .find((candidate): candidate is string => Boolean(candidate)) ?? null;

  return {
    authors,
    publishedAt,
    title,
  };
};
