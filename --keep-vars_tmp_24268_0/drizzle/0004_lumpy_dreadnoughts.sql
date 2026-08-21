CREATE TYPE "public"."transactional_email_status" AS ENUM('queued', 'sending', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'suppressed', 'failed');--> statement-breakpoint
CREATE TABLE "transactional_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"email_kind" text NOT NULL,
	"status" "transactional_email_status" DEFAULT 'queued' NOT NULL,
	"resend_email_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "transactional_email_deliveries_user_kind_unique" ON "transactional_email_deliveries" USING btree ("clerk_user_id","email_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "transactional_email_deliveries_resend_id_unique" ON "transactional_email_deliveries" USING btree ("resend_email_id");--> statement-breakpoint
CREATE INDEX "transactional_email_deliveries_status_index" ON "transactional_email_deliveries" USING btree ("status");