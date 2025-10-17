import { JSDOM } from "jsdom"
import { extractMainFromHtml } from "~/server/content-extractor.server"
import type { CollectedMetadata } from "~/server/document-metadata.server"

type CrawlOptions = {
  maxPages?: number
  sameHostOnly?: boolean
  delayMs?: number
  excludeExtensions?: string[]
}

type CrawledPage = {
  url: string
  title: string
  content: string | null
  textContent: string
  publishedTime: string | null
  byline: string | null
  meta: CollectedMetadata
}

const defaultExclude = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".zip", ".png", ".jpg", ".jpeg", ".gif", ".svg"]

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function crawlSite(startUrl: string, options: CrawlOptions = {}): Promise<CrawledPage[]> {
  const { maxPages = 50, sameHostOnly = true, delayMs = 500, excludeExtensions = defaultExclude } = options
  const start = new URL(startUrl)
  const urlsToVisit: string[] = [startUrl]
  const urlsVisited = new Set<string>()
  const results: CrawledPage[] = []

  const shouldExclude = (href: string) => excludeExtensions.some(ext => href.toLowerCase().endsWith(ext))

  const addLinksFrom = (baseUrl: string, doc: Document) => {
    const anchors = Array.from(doc.querySelectorAll("a")) as HTMLAnchorElement[]
    for (const a of anchors) {
      const target = a.getAttribute("href") || ""
      if (!target) continue
      if (shouldExclude(target)) continue
      try {
        const absolute = new URL(target, baseUrl)
        if (sameHostOnly && absolute.host !== start.host) continue
        const href = absolute.href
        if (!urlsVisited.has(href)) urlsToVisit.push(href)
      } catch {
        // ignore invalid URLs
      }
    }
  }

  console.log("[crawler] start", { startUrl, maxPages, sameHostOnly, delayMs })
  while (urlsToVisit.length > 0 && results.length < maxPages) {
    const currentUrl = urlsToVisit.shift() as string
    if (urlsVisited.has(currentUrl)) continue
    urlsVisited.add(currentUrl)
    try {
      console.log("[crawler] visiting", { currentUrl, visited: urlsVisited.size, queued: urlsToVisit.length, collected: results.length })
      const res = await fetch(currentUrl)
      if (!res.ok) {
        console.warn("[crawler] non-200", { currentUrl, status: res.status })
        continue
      }
      const html = await res.text()
      const extracted = await extractMainFromHtml(html, currentUrl)
      if (extracted) {
        // Build a DOM once here to discover links for future pages
        const { window } = new JSDOM(html, { url: currentUrl })
        addLinksFrom(currentUrl, window.document)
        results.push({
          url: extracted.url,
          title: extracted.title,
          content: extracted.content,
          textContent: extracted.textContent,
          publishedTime: extracted.publishedTime,
          byline: extracted.byline,
          meta: extracted.meta,
        })
        console.log("[crawler] extracted", { url: extracted.url, title: extracted.title?.slice(0, 60) })
      } else {
        console.warn("[crawler] extract returned null", { currentUrl })
      }
    } catch (err) {
      console.error("[crawler] error", { currentUrl, err })
    }
    if (delayMs > 0) await delay(delayMs)
  }

  console.log("[crawler] done", { pagesCollected: results.length, visited: urlsVisited.size })
  return results
}
