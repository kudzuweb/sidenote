import { redirect, type ActionFunctionArgs } from "react-router"
import { requireUser } from "~/server/auth.server"
import { chunkText, generateEmbeddings } from "~/server/document.server"
import { ensureDocumentAllowance } from "~/server/billing.server"
import { extractMainFromUrl } from "~/server/content-extractor.server"
import { crawlSite } from "~/server/crawler.server"
import { resolveDocumentMetadata } from "~/server/document-metadata.server"
import { attachAuthorsToDocument } from "~/server/authors.server"
import { saveDocument, saveDocumentChunks, findDocumentByUrl, ensureUserDocumentLink }  from "../server/documents.server"

export async function action({ request }: ActionFunctionArgs) {


  const userId = await requireUser(request)

  const assertAllowance = async () => {
    try {
      await ensureDocumentAllowance(userId)
    } catch (error) {
      if ((error as any)?.code === "DOCUMENT_LIMIT_REACHED") {
        throw redirect("/workspace?billing=limit")
      }
      throw error
    }
  }

  await assertAllowance()
  const formData = await request.formData()
  const url = String(formData.get("url") || "").trim()
  const crawl = String(formData.get("crawl") || "").trim() === "on"
  const maxPages = Number(String(formData.get("maxPages") || "").trim() || "25")
  const splitMode = String(formData.get("splitMode") || "aggregate") as "split" | "aggregate"
  if (!url || url.length < 1) {
    throw redirect("/workspace")
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    console.warn("[document-create] invalid url submitted", { url, error });
    throw redirect(`/workspace?message=${encodeURIComponent("Enter a valid URL before importing.")}`)
  }
  const normalizedUrl = parsedUrl.toString()
  const existingRootDocument = await findDocumentByUrl(normalizedUrl)

  if (crawl) {
    const pages = await crawlSite(normalizedUrl, { maxPages, sameHostOnly: true })
    if (!pages || pages.length === 0) {
      console.warn("[action] crawl returned no pages", { url, maxPages })
      throw redirect(`/workspace?message=${encodeURIComponent("No pages extracted. Check the URL or try fewer restrictions.")}`)
    }
    if (splitMode === "split") {
      const createdIds: string[] = []
      for (const page of pages) {
        if (!page.textContent) continue
        await assertAllowance()
        if (page.url) {
          const existingPageDocument = await findDocumentByUrl(page.url)
          if (existingPageDocument) {
            await ensureUserDocumentLink(userId, existingPageDocument.id)
            if (!createdIds.includes(existingPageDocument.id)) {
              createdIds.push(existingPageDocument.id)
            }
            continue
          }
        }
        const resolvedMetadata = await resolveDocumentMetadata({
          url: page.url,
          title: page.title ?? null,
          byline: page.byline,
          textContent: page.textContent,
          publishedTime: page.publishedTime,
          meta: page.meta,
        })
        const chunkedDocs = await chunkText(page.textContent)
        const chunkTexts = chunkedDocs.map(d => d.pageContent)
        const embeddings = await generateEmbeddings(chunkTexts)
        const documentId = crypto.randomUUID()
        await saveDocument({
          id: documentId,
          url: page.url,
          title: resolvedMetadata.title ?? page.title ?? "Untitled Document",
          content: page.content ?? "",
          textContent: page.textContent,
          publishedTime: resolvedMetadata.publishedAt ?? page.publishedTime ?? null,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }, userId)
        await attachAuthorsToDocument(documentId, [
          ...resolvedMetadata.authors,
          page.byline,
          ...page.meta.authors,
        ])
        const documentChunks = chunkedDocs.map((doc, index) => ({
          id: crypto.randomUUID(),
          documentId,
          text: doc.pageContent,
          chunkIndex: index,
          embedding: embeddings[index],
        }))
        await saveDocumentChunks(documentChunks)
        createdIds.push(documentId)
      }
      const firstId = createdIds[0]
      if (!firstId) {
        throw redirect(`/workspace?message=${encodeURIComponent("No new pages were imported.")}`)
      }
      throw redirect("/workspace/document/" + firstId)
    } else {
      if (existingRootDocument) {
        await ensureUserDocumentLink(userId, existingRootDocument.id)
        throw redirect("/workspace/document/" + existingRootDocument.id)
      }
      const allText = pages.map(p => p.textContent).filter(Boolean).join("\n\n")
      if (!allText || allText.length < 1) throw redirect("/workspace")
      const primaryPage = pages[0]
      const resolvedMetadata = primaryPage
        ? await resolveDocumentMetadata({
            url: primaryPage.url,
            title: primaryPage.title ?? null,
            byline: primaryPage.byline,
            textContent: allText,
            publishedTime: primaryPage.publishedTime,
            meta: primaryPage.meta,
          })
        : { authors: [], publishedAt: null, title: null }
      const chunkedDocs = await chunkText(allText)
      const chunkTexts = chunkedDocs.map(doc => doc.pageContent)
      const embeddings = await generateEmbeddings(chunkTexts)
      const documentId = crypto.randomUUID()
      await saveDocument({
        id: documentId,
        url: normalizedUrl,
        title: resolvedMetadata.title ?? primaryPage?.title ?? "Untitled Document",
        content: "",
        textContent: allText,
        publishedTime: resolvedMetadata.publishedAt ?? primaryPage?.publishedTime ?? null,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, userId)
      await attachAuthorsToDocument(documentId, [
        ...(resolvedMetadata?.authors ?? []),
        primaryPage?.byline,
        ...(primaryPage?.meta.authors ?? []),
      ])
      const documentChunks = chunkedDocs.map((doc, index) => ({
        id: crypto.randomUUID(),
        documentId,
        text: doc.pageContent,
        chunkIndex: index,
        embedding: embeddings[index],
      }))
      await saveDocumentChunks(documentChunks)
      throw redirect("/workspace/document/" + documentId)
    }
  }

  if (!crawl && existingRootDocument) {
    await ensureUserDocumentLink(userId, existingRootDocument.id)
    throw redirect("/workspace/document/" + existingRootDocument.id)
  }

  const article = await extractMainFromUrl(normalizedUrl)
  if (!article) return

  const resolvedMetadata = await resolveDocumentMetadata({
    url: normalizedUrl,
    title: article.title ?? null,
    byline: article.byline,
    textContent: article.textContent,
    publishedTime: article.publishedTime,
    meta: article.meta,
  })

  const rawText = article.textContent

  // function insertBeforeChar(str: string, target: string, insert: string): string {
  //   return str
  //     .split("")
  //     .map(c => (c === target ? insert + c : c))
  //     .join("");
  // }

  // const result = insertBeforeChar(rawText, "<p>", "\n");
  const styledText = rawText.replace("<p>", "<br> <p>")

  const chunkedDocs = await chunkText(styledText)

  const chunkTexts = chunkedDocs.map(doc => doc.pageContent)

  const embeddings = await generateEmbeddings(chunkTexts)

  const documentId = crypto.randomUUID()
  const document = {
    id: documentId,
    url: normalizedUrl,
    title: resolvedMetadata.title ?? article.title ?? "Untitled Document",
    content: article.content ?? "",
    textContent: article.textContent,
    publishedTime: resolvedMetadata.publishedAt ?? article.publishedTime ?? null,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await saveDocument(document, userId)

  // if (article.byline) {
  //   // split by ',' 'and' '&'
  //   const authorNames = article.byline
  //     .split(/,|\sand\s|\s&\s/)
  //     .map(name => name.trim())
  //     .filter(name => name.length > 0);

  //   for (const authorName of authorNames) {
  //     const existingAuthors = await getAuthors(userId, authorName);
  //     const existingAuthor = existingAuthors.find(author => author.name.toLowerCase() === authorName.toLowerCase());

  //     let authorId: string;
  //     if (existingAuthor) {
  //       authorId = existingAuthor.id;
  //     } else {
  //       const newAuthor = await createAuthor(userId, authorName);
  //       authorId = newAuthor.id;
  //     }

  //     await linkDocumentToAuthor(documentId, authorId);
  //   }
  // }

  const documentChunks = chunkedDocs.map((doc, index) => ({
    id: crypto.randomUUID(),
    documentId: documentId,
    text: doc.pageContent,
    chunkIndex: index,
    embedding: embeddings[index],
  }))

  await attachAuthorsToDocument(documentId, [
    ...resolvedMetadata.authors,
    article.byline,
    ...article.meta.authors,
  ])
  await saveDocumentChunks(documentChunks)

  throw redirect("/workspace/document/" + documentId)
}
