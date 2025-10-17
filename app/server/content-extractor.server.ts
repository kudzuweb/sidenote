import { JSDOM } from "jsdom"
import { Readability } from "@mozilla/readability"
import { collectDocumentMetadata } from "./document-metadata.server"

export type ExtractedContent = {
  url: string
  title: string
  content: string | null
  textContent: string
  byline: string | null
  publishedTime: string | null
  meta: ReturnType<typeof collectDocumentMetadata>
}

export async function extractMainFromHtml(html: string, url: string): Promise<ExtractedContent | null> {
  try {
    const dom = new JSDOM(html, { url })
    const doc = dom.window.document
    const meta = collectDocumentMetadata(doc)
    const reader = new Readability(doc)
    const article = reader.parse()
    if (!article || !article.textContent) {
      console.warn("[extractor] no main content", { url })
      return null
    }

    return {
      url,
      title: article.title ?? "Untitled Document",
      content: article.content ?? null,
      textContent: article.textContent,
      byline: article.byline ?? null,
      publishedTime: article.publishedTime ?? null,
      meta,
    }
  } catch (err) {
    console.error("[extractor] error parsing html", { url, err })
    return null
  }
}

export async function extractMainFromUrl(url: string): Promise<ExtractedContent | null> {
  try {
    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(url).toString();
    } catch (urlError) {
      console.warn("[extractor] invalid url provided", { url, urlError });
      return null;
    }
    const res = await fetch(normalizedUrl)
    if (!res.ok) {
      console.warn("[extractor] fetch non-200", { url, status: res.status })
      return null
    }
    const html = await res.text()
    return extractMainFromHtml(html, normalizedUrl)
  } catch (err) {
    console.error("[extractor] fetch error", { url, err })
    return null
  }
}
