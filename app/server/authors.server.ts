import { and, eq, ilike } from "drizzle-orm"
import { authorTable, documentAuthorsTable, documentTable } from "~/db/schema"
import { db } from "~/server/index.server"
import type { Author, AuthorBasic, AuthorRow } from "~/types/types"
import { parseAuthorNames } from "./document-metadata.server"

export const getAuthors = async (searchTerm?: string): Promise<AuthorBasic[]> => {
  let query = db.select().from(authorTable).orderBy(authorTable.name).limit(10)
  if (searchTerm) {
    query = query.where(ilike(authorTable.name, `%${searchTerm}%`))
  }
  const results = await query

  return results.map(r => ({ id: r.id, name: r.name }))
}

export const getAuthor = async (id: string): Promise<Author | null> => {
  const results = await db.select().from(authorTable).where(eq(authorTable.id, id))
  if (results.length === 0) return null
  return authorRowToObject(results[0])
}

export const createAuthor = async (name: string): Promise<AuthorBasic> => {
  const id = crypto.randomUUID()
  const result = await db.insert(authorTable).values({ id: id, name: name }).returning()
  return { id: result[0].id, name: result[0].name }
}

export const getOrCreateAuthor = async (name: string): Promise<AuthorBasic> => {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error("cannot create author with empty name")
  }

  const existing = await db
    .select({ id: authorTable.id, name: authorTable.name })
    .from(authorTable)
    .where(ilike(authorTable.name, normalized))
    .limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  return createAuthor(normalized)
}

export const getAuthorDocuments = async (authorId: string): Promise<string[]> => {
  const results = await db
    .select({ documentId: documentAuthorsTable.documentId })
    .from(documentAuthorsTable)
    .innerJoin(documentTable, eq(documentAuthorsTable.documentId, documentTable.id))
    .where(eq(documentAuthorsTable.authorId, authorId))

  return results.map(r => r.documentId)
}

export const linkDocumentToAuthor = async (documentId: string, authorId: string): Promise<void> => {
  const existing = await db
    .select({ id: documentAuthorsTable.id })
    .from(documentAuthorsTable)
    .where(and(eq(documentAuthorsTable.documentId, documentId), eq(documentAuthorsTable.authorId, authorId)))
    .limit(1)

  if (existing.length > 0) return

  const id = crypto.randomUUID()
  await db.insert(documentAuthorsTable).values({ id, documentId, authorId })
}

export const getDocumentAuthors = async (documentId: string): Promise<AuthorBasic[]> => {
  const results = await db
    .select({ id: authorTable.id, name: authorTable.name })
    .from(documentAuthorsTable)
    .innerJoin(authorTable, eq(documentAuthorsTable.authorId, authorTable.id))
    .where(eq(documentAuthorsTable.documentId, documentId))

  return results
}

const authorRowToObject = (row: AuthorRow): Author => {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export const attachAuthorsToDocument = async (
  documentId: string,
  candidateNames: Array<string | null | undefined>
): Promise<void> => {
  const parsed = candidateNames
    .flatMap(name => parseAuthorNames(name ?? ""))
    .filter(Boolean)

  if (parsed.length === 0) return

  const seen = new Set<string>()
  for (const name of parsed) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const author = await getOrCreateAuthor(name)
    await linkDocumentToAuthor(documentId, author.id)
  }
}

const authorObjectToRow = (author: Author) => {
  return {
    id: author.id,
    name: author.name,
    createdAt: author.createdAt,
    updatedAt: author.updatedAt
  }
}
