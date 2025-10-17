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


const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB


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
        try {
          const parsed = await extractPdfText(buffer);
          pdfText = parsed.text;
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

        const now = new Date();
        const document: DocumentCreate = {
            id: documentId,
            url: publicUrl,
            title: (file.name || "Untitled PDF").replace(/\.[^/.]+$/, ""),
            content: "",
            textContent: pdfText,
            publishedTime: null,
            createdAt: now,
            updatedAt: now,
        };
        await saveDocument(document);

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

        const documentId = crypto.randomUUID()
        const now = new Date();
        const document: DocumentCreate = {
            id: documentId,
            url: "epub",
            title: book.metadata.title,
            content: html,
            textContent: null,
            publishedTime: null,
            createdAt: now,
            updatedAt: now,
        }
        await saveDocument(document)
        return redirect(`/workspace/document/${documentId}`)
    } finally {
        await unlink(tmpPath).catch(() => { });
    }
}
