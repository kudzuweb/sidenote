import { redirect, type ActionFunctionArgs } from "react-router"
import { requireUser } from "~/server/auth.server"
import { chunkText, generateEmbeddings } from "~/server/document.server"
import { ensureDocumentAllowance } from "~/server/billing.server"
import { extractMainFromUrl } from "~/server/content-extractor.server"
import { crawlSite } from "~/server/crawler.server"

export async function action({ request }: ActionFunctionArgs) {
  const { saveDocument, saveDocumentChunks } = await import("../server/documents.server")


  const userId = await requireUser(request)
  try {
    await ensureDocumentAllowance(userId)
  } catch (error) {
    if ((error as any)?.code === "DOCUMENT_LIMIT_REACHED") {
      throw redirect("/workspace?billing=limit")
    }
    throw error
  }
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
        const chunkedDocs = await chunkText(page.textContent)
        const chunkTexts = chunkedDocs.map(d => d.pageContent)
        const embeddings = await generateEmbeddings(chunkTexts)
        const documentId = crypto.randomUUID()
        await saveDocument({
          id: documentId,
          url: page.url,
          title: page.title ?? "Untitled Document",
          content: page.content ?? "",
          textContent: page.textContent,
          publishedTime: page.publishedTime ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
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
      throw redirect("/workspace/document/" + firstId)
    } else {
      const allText = pages.map(p => p.textContent).filter(Boolean).join("\n\n")
      if (!allText || allText.length < 1) throw redirect("/workspace")
      const chunkedDocs = await chunkText(allText)
      const chunkTexts = chunkedDocs.map(doc => doc.pageContent)
      const embeddings = await generateEmbeddings(chunkTexts)
      const documentId = crypto.randomUUID()
      await saveDocument({
        id: documentId,
        url: normalizedUrl,
        title: pages[0]?.title ?? "Untitled Document",
        content: "",
        textContent: allText,
        publishedTime: pages[0]?.publishedTime ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
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

  const article = await extractMainFromUrl(normalizedUrl)
  if (!article) return

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
    title: article.title ?? "Untitled Document",
    content: article.content ?? "",
    textContent: article.textContent,
    publishedTime: article.publishedTime ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await saveDocument(document)

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

  await saveDocumentChunks(documentChunks)

  throw redirect("/workspace/document/" + documentId)
}
