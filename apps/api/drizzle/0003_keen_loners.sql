CREATE TABLE "phone_verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "phone_verification_challenges_user_unique" ON "phone_verification_challenges" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_phone_number_unique" ON "user_profiles" USING btree ("phone_number");