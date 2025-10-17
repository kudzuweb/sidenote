import { and, eq, inArray } from "drizzle-orm";
import { annotation, groupDocumentTable, groupMemberTable, groupTable, permissionTable, userDocumentTable } from "~/db/schema";
import { db } from "~/server/index.server";
import type { Annotation, AnnotationCreate, AnnotationRow } from "~/types/types";
import { NotFoundError } from "./errors.server";
import { getUserGroupIds, requirePermission } from "./permissions.server.helper";

export const getAnnotation = async (userId: string, annotationId: string):Promise<Annotation> => {
  await requirePermission(userId, "annotation", annotationId, "read");

  const annotationRow = await db
    .select()
    .from(annotation)
    .where(eq(annotation.id, annotationId));

  if (annotationRow.length === 0) {
    throw new NotFoundError("Annotation", annotationId);
  }

  return annotationRowToObject(annotationRow[0]);
}

export const saveAnnotations = async (annotationToSave: AnnotationCreate):Promise<void> => {
  const dbAnnotation = annotationObjectToRow(annotationToSave)
  await db.insert(annotation).values(dbAnnotation).onConflictDoUpdate({ target: annotation.id, set: dbAnnotation })
}

export const deleteAnnotations = async (userId: string, id: string) => {
  await requirePermission(userId, "annotation", id, "write");

  return await db.delete(annotation).where(eq(annotation.id, id));
}

// all annos for a doc
export const getAnnotations = async (userId: string, documentId: string) => {
  await requirePermission(userId, "document", documentId, "read");

  const userGroupIds = await getUserGroupIds(userId);

  const documentGroups = await db
    .select({ groupId: groupDocumentTable.groupId })
    .from(groupDocumentTable)
    .where(eq(groupDocumentTable.documentId, documentId));

  const documentGroupIds = new Set(documentGroups.map((g) => g.groupId));

  const documentPermissions = await db
    .select({
      principalType: permissionTable.principalType,
      principalId: permissionTable.principalId,
    })
    .from(permissionTable)
    .where(
      and(
        eq(permissionTable.resourceType, "document" as any),
        eq(permissionTable.resourceId, documentId)
      )
    );

  const permissionGroupIds = documentPermissions
    .filter((perm) => perm.principalType === "group")
    .map((perm) => perm.principalId);

  for (const groupId of permissionGroupIds) {
    documentGroupIds.add(groupId);
  }

  // intersection of user's groups & document-linked groups
  const sharedGroupIds = userGroupIds.filter((id) =>
    documentGroupIds.has(id)
  );

  // all members of user's groups
  const groupMemberUserIds =
    sharedGroupIds.length > 0
      ? await db
        .select({ userId: groupMemberTable.userId })
        .from(groupMemberTable)
        .where(inArray(groupMemberTable.groupId, sharedGroupIds))
      : [];

  const groupOwnerUserIds =
    sharedGroupIds.length > 0
      ? await db
        .select({ ownerId: groupTable.userId })
        .from(groupTable)
        .where(inArray(groupTable.id, sharedGroupIds))
      : [];

  const documentUserLinks = await db
    .select({ userId: userDocumentTable.userId })
    .from(userDocumentTable)
    .where(eq(userDocumentTable.documentId, documentId));

  const permissionUserIds = [
    ...new Set(
      documentPermissions
        .filter((perm) => perm.principalType === "user")
        .map((perm) => perm.principalId)
    ),
  ];

  const collaboratorIdsSet = new Set<string>([
    userId,
    ...permissionUserIds,
    ...documentUserLinks.map((entry) => entry.userId),
    ...groupMemberUserIds.map((m) => m.userId),
    ...groupOwnerUserIds.map((g) => g.ownerId),
  ]);

  const collaboratorIds = [...collaboratorIdsSet];

  const annotations = await db
    .select()
    .from(annotation)
    .where(eq(annotation.documentId, documentId));

  const accessibleAnnotations = annotations.filter((anno) => {
    // creator's annos
    if (anno.userId === userId) return true;

    if (anno.visibility === "private") return false

    // group member annos
    if (collaboratorIds.includes(anno.userId)) return true

    // public annos
    if (anno.visibility === "public") return true

    // check if user has explicit permission?
    return false;
  });

  return accessibleAnnotations.map((a) => annotationRowToObject(a));
}


const annotationObjectToRow = (annotation: AnnotationCreate) => {
  return {
    id: annotation.id,
    userId: annotation.userId,
    documentId: annotation.documentId,
    body: annotation.body,
    start: annotation.start,
    color: annotation.color,
    end: annotation.end,
    quote: annotation.quote,
    prefix: annotation.prefix,
    suffix: annotation.suffix,
    visibility: annotation.visibility,
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt
  }
}

const annotationRowToObject = (row: AnnotationRow): Annotation => {
  return {
    id: row.id,
    userId: row.userId,
    documentId: row.documentId,
    body: row.body,
    start: row.start,
    color: row.color,
    end: row.end,
    quote: row.quote,
    prefix: row.prefix,
    suffix: row.suffix,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
