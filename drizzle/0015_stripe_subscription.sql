CREATE TYPE "public"."plan" AS ENUM ('free', 'pro');

CREATE TYPE "public"."subscription_status" AS ENUM ('inactive', 'trialing', 'active', 'past_due', 'canceled');

CREATE TABLE "user_document" (
  "user_id" text NOT NULL,
  "document_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_document_user_id_document_id_pk" PRIMARY KEY ("user_id","document_id")
);

ALTER TABLE "user_document" ADD CONSTRAINT "user_document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "user_document" ADD CONSTRAINT "user_document_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "user_subscription" (
  "user_id" text NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "plan" "public"."plan" DEFAULT 'free' NOT NULL,
  "status" "public"."subscription_status" DEFAULT 'inactive' NOT NULL,
  "current_period_end" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_subscription_user_id_pk" PRIMARY KEY ("user_id")
);

ALTER TABLE "user_subscription" ADD CONSTRAINT "user_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
