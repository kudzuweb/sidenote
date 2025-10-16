import { EPub } from 'epub2';
import { mkdir, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { redirect, type ActionFunctionArgs } from "react-router";
import { requireUser } from "~/server/auth.server";
import { saveDocument } from "~/server/documents.server";
import { fileTypeFromBuffer } from "file-type";
import type { DocumentCreate } from "~/types/types";
import { supabaseAdmin } from "~/server/supabase.server";


export async function action({ request }: ActionFunctionArgs) {
    const form = await request.formData();
    const userId = await requireUser(request)

    const file = form.get('file') as File | null;
    if (!file) throw new Response("missing file", { status: 400 });
    if (file.size > 5 * 1024 * 1024) throw new Response("file too large", { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = await fileTypeFromBuffer(buffer);
    const isPdf = detected?.mime === "application/pdf" || /\.pdf$/i.test(file.name ?? "");
    const isEpub = detected?.mime === "application/epub+zip" || /\.epub$/i.test(file.name ?? "");

    if (isPdf) {
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
            textContent: null,
            publishedTime: null,
            createdAt: now,
            updatedAt: now,
        };
        await saveDocument(document);

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