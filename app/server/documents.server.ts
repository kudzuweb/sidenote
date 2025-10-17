import { documentChunksTable, documentTable, permissionTable, userDocumentTable } from "~/db/schema"
import { db } from "~/server/index.server"
import { and, eq, count } from "drizzle-orm"
import { requirePermission } from "./permissions.server.helper"
import type { Document, DocumentCreate, DocumentChunk, DocumentRow, DocumentRole } from "~/types/types"

export const getAllDocuments = async (): Promise<DocumentRow[]> => {
  const results = await db.select().from(documentTable)
  return results
}

export const getDocuments = async (userId?: string): Promise<DocumentRow[]> => {
  if (!userId) {
    return await db.select().from(documentTable)
  }

  const results = await db
    .select({ document: documentTable })
    .from(userDocumentTable)
    .innerJoin(documentTable, eq(userDocumentTable.documentId, documentTable.id))
    .where(eq(userDocumentTable.userId, userId))

  return results.map(result => result.document)
}

export const getDocument = async (id: string, userId?: string) => {
  if (userId) {
    await requirePermission(userId, "document", id, "read")
  }

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

export const findDocumentByUrl = async (url: string): Promise<DocumentRow | null> => {
  if (!url) return null
  const results = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.url, url))
    .limit(1)
  return results[0] ?? null
}

export const ensureUserDocumentLink = async (
  userId: string,
  documentId: string,
  role: DocumentRole = "viewer"
) => {
  if (!userId || !documentId) return

  const existing = await db
    .select({ role: userDocumentTable.role })
    .from(userDocumentTable)
    .where(
      and(
        eq(userDocumentTable.userId, userId),
        eq(userDocumentTable.documentId, documentId)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    if (role === "owner" && existing[0].role !== "owner") {
      await linkUserToDocument(userId, documentId, role)
    }
    return
  }

  await linkUserToDocument(userId, documentId, role)
}

export const linkUserToDocument = async (
  userId: string,
  documentId: string,
  role: DocumentRole = "viewer"
): Promise<{ success: true }> => {
  const now = new Date()

  await db
    .insert(userDocumentTable)
    .values({
      userId,
      documentId,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userDocumentTable.userId, userDocumentTable.documentId],
      set: {
        role,
        updatedAt: now,
      },
    })

  const permissionLevel = role === "owner" ? "admin" : "read"

  await db
    .insert(permissionTable)
    .values({
      resourceType: "document" as any,
      resourceId: documentId,
      principalType: "user" as any,
      principalId: userId,
      permissionLevel: permissionLevel as any,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        permissionTable.resourceType,
        permissionTable.resourceId,
        permissionTable.principalType,
        permissionTable.principalId,
      ],
      set: {
        permissionLevel: permissionLevel as any,
        updatedAt: now,
      },
    })

  return { success: true }
}

export const saveDocument = async (
  document: DocumentCreate,
  ownerUserId?: string,
  role: DocumentRole = "owner"
) => {
  const createdAt = document.createdAt ?? new Date()
  const updatedAt = document.updatedAt ?? new Date()
  const dbDocument = documentObjectToRow({ ...document, createdAt, updatedAt })
  await db
    .insert(documentTable)
    .values(dbDocument)
    .onConflictDoUpdate({ target: documentTable.id, set: dbDocument })

  const linkingUserId = ownerUserId ?? document.userId
  if (linkingUserId) {
    await linkUserToDocument(linkingUserId, document.id, role)
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
    .where(
      and(
        eq(userDocumentTable.userId, userId),
        eq(userDocumentTable.role, "owner")
      )
    )

  return result[0]?.count ? Number(result[0].count) : 0
}

export const userHasDocument = async (userId: string, documentId: string) => {
  const result = await db
    .select({ documentId: userDocumentTable.documentId })
    .from(userDocumentTable)
    .where(
      and(
        eq(userDocumentTable.userId, userId),
        eq(userDocumentTable.documentId, documentId),
        eq(userDocumentTable.role, "owner")
      )
    )

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
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date()
  }
}
