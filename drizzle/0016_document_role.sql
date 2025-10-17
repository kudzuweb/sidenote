DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_role') THEN
    CREATE TYPE "document_role" AS ENUM ('owner', 'viewer');
  END IF;
END $$;

ALTER TABLE "user_document"
ADD COLUMN IF NOT EXISTS "role" "document_role" DEFAULT 'owner' NOT NULL;

-- ensure existing records are marked as owners
UPDATE "user_document" SET "role" = 'owner' WHERE "role" IS NULL;
