CREATE TYPE "public"."account_type" AS ENUM('personal', 'business');--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"image_url" text,
	"account_type" "account_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_clerk_user_id_unique" ON "user_profiles" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_email_index" ON "user_profiles" USING btree ("email");