ALTER TABLE "user_profiles" ADD COLUMN "finora_tag" text;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_finora_tag_unique" ON "user_profiles" USING btree ("finora_tag");