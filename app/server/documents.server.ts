import { documentChunksTable, documentTable, userDocumentTable } from "~/db/schema"
import { db } from "~/server/index.server"
import { and, eq, count } from "drizzle-orm"
import type { Document, DocumentCreate, DocumentChunk, DocumentRow } from "~/types/types"

export const getAllDocuments = async (): Promise<DocumentRow[]> => {
  const results = await db.select().from(documentTable)
  return results
}

export const getDocuments = async (userId?: string) => {
  if (!userId) {
    return db.select().from(documentTable)
  }

  const results = await db
    .select({
      id: documentTable.id,
      url: documentTable.url,
      title: documentTable.title,
      content: documentTable.content,
      textContent: documentTable.textContent,
      publishedTime: documentTable.publishedTime,
      createdAt: documentTable.createdAt,
      updatedAt: documentTable.updatedAt,
    })
    .from(userDocumentTable)
    .innerJoin(documentTable, eq(userDocumentTable.documentId, documentTable.id))
    .where(eq(userDocumentTable.userId, userId))

  return results
}

export const getDocument = async (id: string) => {
  const document = await db.select().from(documentTable).where(eq(documentTable.id, id))
  if (!document) return null
  // const annotations = await db.select().from(annotation).where(eq(annotation.docId, id))
  // const comments = await db.select().from(comment).leftJoin(annotation, eq(comment.annotationId, annotation.id)).where(inArray(comment.annotationId, annotations.map(annotation => annotation.id)))
  // const annotationsWithComments = annotations.map(annotation => ({
  //   ...annotation, comments: comments.filter(comment => comment.annotationId === annotation.id)
  // }))
  // const results = { ...document[0], annotations: annotationsWithComments }
  // return results
  return document[0]
}

export const saveDocument = async (document: DocumentCreate) => {
  const dbDocument = documentObjectToRow(document)
  await db
    .insert(documentTable)
    .values(dbDocument)
    .onConflictDoUpdate({ target: documentTable.id, set: dbDocument })

  if (document.userId) {
    await db
      .insert(userDocumentTable)
      .values({
        userId: document.userId,
        documentId: document.id,
        createdAt: document.createdAt ?? new Date(),
        updatedAt: document.updatedAt ?? new Date(),
      })
      .onConflictDoNothing({ target: [userDocumentTable.userId, userDocumentTable.documentId] })
  }

  return { success: true }
}

export const saveDocumentChunks = async (chunks: DocumentChunk[]) => {
  if (chunks.length === 0) return

  const dbChunks = chunks.map(chunk => ({
    id: chunk.id,
    documentId: chunk.documentId,
    text: chunk.text,
    chunkIndex: chunk.chunkIndex,
    embedding: chunk.embedding
  }))

  return await db.insert(documentChunksTable).values(dbChunks)
}

export const getUserDocumentCount = async (userId: string) => {
  const result = await db
    .select({ count: count(userDocumentTable.documentId) })
    .from(userDocumentTable)
    .where(eq(userDocumentTable.userId, userId))

  return result[0]?.count ? Number(result[0].count) : 0
}

export const userHasDocument = async (userId: string, documentId: string) => {
  const result = await db
    .select({ documentId: userDocumentTable.documentId })
    .from(userDocumentTable)
    .where(and(eq(userDocumentTable.userId, userId), eq(userDocumentTable.documentId, documentId)))

  return result.length > 0
}

const documentRowToObject = (row: DocumentRow): Document => {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    content: row.content,
    textContent: row.textContent,
    publishedTime: row.publishedTime,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

const documentObjectToRow = (doc: DocumentCreate) => {
  return {
    id: doc.id,
    url: doc.url,
    title: doc.title,
    content: doc.content,
    textContent: doc.textContent,
    publishedTime: doc.publishedTime,
    visibility: doc.visibility,
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date()
  }
}
