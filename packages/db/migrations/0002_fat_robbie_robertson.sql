ALTER TYPE "public"."asset_status" ADD VALUE 'uploading';--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "upload" jsonb;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "upload_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "failure_reason" text;--> statement-breakpoint
CREATE INDEX "assets_upload_expires_at_idx" ON "assets" USING btree ("upload_expires_at");