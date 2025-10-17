import { EPub } from 'epub2';
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { redirect, type ActionFunctionArgs } from "react-router";
import { requireUser } from "~/server/auth.server";
import { saveDocument, saveDocumentChunks } from "~/server/documents.server";
import { fileTypeFromBuffer } from "file-type";
import type { DocumentCreate } from "~/types/types";
import { supabaseAdmin } from "~/server/supabase.server";
import { chunkText, generateEmbeddings } from "~/server/document.server";
import { extractPdfText, PdfExtractionError } from "~/server/pdf-extractor.server";
import { ensureDocumentAllowance } from "~/server/billing.server";
import { resolveDocumentMetadata, parseAuthorNames } from "~/server/document-metadata.server";
import type { CollectedMetadata } from "~/server/document-metadata.server";
import { attachAuthorsToDocument } from "~/server/authors.server";


const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const flattenMetadataValue = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap(entry => flattenMetadataValue(entry));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidates: string[] = [];
    if (typeof obj.name === "string") candidates.push(obj.name);
    if (typeof obj.value === "string") candidates.push(obj.value);
    if (typeof obj.text === "string") candidates.push(obj.text);
    if (typeof obj.title === "string") candidates.push(obj.title);
    return candidates.length > 0 ? candidates : [];
  }
  return [];
};

const collectRecordMetadata = (
  record: Record<string, unknown> | null | undefined,
  authorKeys: string[],
  dateKeys: string[]
): CollectedMetadata => {
  const authorsSet = new Set<string>();
  const publishedSet = new Set<string>();
  const raw: Record<string, string> = {};

  if (!record) {
    return { authors: [], publishedTimes: [], raw };
  }

  const entries = Object.entries(record);
  const lookup = new Map<string, unknown>();
  for (const [key, value] of entries) {
    lookup.set(key.toLowerCase(), value);
  }

  for (const key of authorKeys) {
    const values = flattenMetadataValue(lookup.get(key.toLowerCase()));
    for (const value of values) {
      parseAuthorNames(value).forEach(name => {
        if (!name) return;
        authorsSet.add(name);
      });
    }
  }

  for (const key of dateKeys) {
    const values = flattenMetadataValue(lookup.get(key.toLowerCase()));
    for (const value of values) {
      const normalized = String(value).trim();
      if (!normalized) continue;
      publishedSet.add(normalized);
    }
  }

  for (const [key, value] of entries) {
    const texts = flattenMetadataValue(value);
    if (texts.length === 0) continue;
    raw[`meta_${key}`] = texts.join(", ");
  }

  return {
    authors: Array.from(authorsSet),
    publishedTimes: Array.from(publishedSet),
    raw,
  };
};


export async function action({ request }: ActionFunctionArgs) {
    const form = await request.formData();
    const userId = await requireUser(request)
    try {
        await ensureDocumentAllowance(userId)
    } catch (error) {
        if ((error as any)?.code === "DOCUMENT_LIMIT_REACHED") {
            throw redirect("/workspace?billing=limit")
        }
        throw error
    }

    const file = form.get('file') as File | null;
    if (!file) throw new Response("missing file", { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) throw new Response("file too large", { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = await fileTypeFromBuffer(buffer);
    const isPdf = detected?.mime === "application/pdf" || /\.pdf$/i.test(file.name ?? "");
    const isEpub = detected?.mime === "application/epub+zip" || /\.epub$/i.test(file.name ?? "");

    if (isPdf) {
        let pdfText: string;
        let pdfCollectedMeta: CollectedMetadata = { authors: [], publishedTimes: [], raw: {} };
        try {
          const parsed = await extractPdfText(buffer);
          pdfText = parsed.text;
          pdfCollectedMeta = collectRecordMetadata(
            parsed.metadata as Record<string, unknown> | null,
            ["Author", "author", "Creator", "creator", "dc:creator", "dc:contributors", "meta:author"],
            ["CreationDate", "ModDate", "Date", "xap:CreateDate", "xmp:CreateDate", "dcterms:created", "meta:creation-date"]
          );
        } catch (error) {
          if (error instanceof PdfExtractionError) {
            console.warn("[api.upload] pdf text extraction failed", { message: error.message });
            throw new Response("Could not extract text from this PDF. It may be scanned or protected.", { status: 422 });
          }
          console.error("[api.upload] unexpected pdf extraction error", error);
          throw new Response("Unexpected error while processing PDF", { status: 500 });
        }

        const chunkedDocs = await chunkText(pdfText);
        if (chunkedDocs.length === 0) {
          throw new Response("PDF contained no readable text", { status: 422 });
        }
        const chunkTexts = chunkedDocs.map(doc => doc.pageContent);

        let embeddings: number[][] | Float32Array[];
        try {
          embeddings = await generateEmbeddings(chunkTexts);
        } catch (error) {
          console.error("[api.upload] embedding generation failed", error);
          throw new Response("Failed to generate embeddings for this PDF", { status: 500 });
        }

        const documentId = crypto.randomUUID();
        const filename = `${documentId}.pdf`;
        const bucket = process.env.SUPABASE_BUCKET || "documents";

        const { error: uploadError } = await supabaseAdmin.storage
          .from(bucket)
          .upload(filename, buffer, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (uploadError) {
          throw new Response("failed to upload to storage", { status: 500, statusText: uploadError.message });
        }

        const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(filename);
        const publicUrl = publicUrlData?.publicUrl ?? `/${bucket}/${filename}`;

        const resolvedMetadata = await resolveDocumentMetadata({
          url: publicUrl,
          title: (file.name || "Untitled PDF").replace(/\.[^/.]+$/, ""),
          byline: null,
          textContent: pdfText,
          publishedTime: null,
          meta: pdfCollectedMeta,
        });

        const now = new Date();
        const document: DocumentCreate = {
            id: documentId,
            url: publicUrl,
            title: resolvedMetadata.title ?? (file.name || "Untitled PDF").replace(/\.[^/.]+$/, ""),
            content: "",
            textContent: pdfText,
            publishedTime: resolvedMetadata.publishedAt ?? null,
            userId,
            createdAt: now,
            updatedAt: now,
        };
        await saveDocument(document);
        await attachAuthorsToDocument(documentId, [
          ...resolvedMetadata.authors,
          ...pdfCollectedMeta.authors,
        ]);

        const documentChunks = chunkedDocs.map((doc, index) => ({
          id: crypto.randomUUID(),
          documentId,
          text: doc.pageContent,
          chunkIndex: index,
          embedding: embeddings[index],
        }));
        await saveDocumentChunks(documentChunks);

        return redirect(`/workspace/document/${documentId}`);
    }

    if (!isEpub) {
        throw new Response("unsupported file type", { status: 415 });
    }

    const tmpPath = join(tmpdir(), `${crypto.randomUUID()}.epub`);
    await writeFile(tmpPath, buffer);

    try {
        const book = await EPub.createAsync(tmpPath);
        const htmlChapters = await Promise.all(
            book.flow.map((ch: any) => book.getChapterRawAsync(ch.id))
        )
        const html = htmlChapters.join('\n')
        const epubMeta = collectRecordMetadata(
          book.metadata as Record<string, unknown> | null,
          ["creator", "creatorfileas", "contributor", "author"],
          ["date", "modified", "pubdate", "published"]
        )
        const plainText = html
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000)

        const resolvedMetadata = await resolveDocumentMetadata({
          url: "epub",
          title: book.metadata?.title ?? (file.name || "Untitled EPUB"),
          byline: null,
          textContent: plainText,
          publishedTime: epubMeta.publishedTimes[0] ?? null,
          meta: epubMeta,
        })

        const documentId = crypto.randomUUID()
        const now = new Date();
        const document: DocumentCreate = {
            id: documentId,
            url: "epub",
            title: resolvedMetadata.title ?? book.metadata?.title ?? (file.name || "Untitled EPUB"),
            content: html,
            textContent: null,
            publishedTime: resolvedMetadata.publishedAt ?? epubMeta.publishedTimes[0] ?? null,
            userId,
            createdAt: now,
            updatedAt: now,
        }
        await saveDocument(document)
        await attachAuthorsToDocument(documentId, [
          ...resolvedMetadata.authors,
          ...epubMeta.authors,
        ])
        return redirect(`/workspace/document/${documentId}`)
    } finally {
        await unlink(tmpPath).catch(() => { });
    }
}
