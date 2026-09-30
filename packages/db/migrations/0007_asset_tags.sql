ALTER TABLE "assets" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "assets_tags_idx" ON "assets" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "assets_filename_trgm_idx" ON "assets" USING gin ("filename" gin_trgm_ops);