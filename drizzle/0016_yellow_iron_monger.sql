CREATE TYPE "public"."document_role" AS ENUM('owner', 'viewer');--> statement-breakpoint
ALTER TABLE "user_subscription" DROP CONSTRAINT "user_subscription_user_id_pk";--> statement-breakpoint
ALTER TABLE "user_document" ADD COLUMN "role" "document_role" DEFAULT 'owner' NOT NULL;--> statement-breakpoint
DELETE FROM "document_chunks"
WHERE NOT EXISTS (
  SELECT 1 FROM "document" WHERE "document"."id" = "document_chunks"."document_id"
);--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;
