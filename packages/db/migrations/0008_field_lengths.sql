CREATE OR REPLACE FUNCTION tags_within_limit(tags text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT cardinality(tags) <= 32
     AND NOT EXISTS (
       SELECT 1 FROM unnest(tags) AS tag WHERE char_length(tag) > 32
     );
$$;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_filename_length" CHECK (char_length("filename") <= 255);--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_mime_type_length" CHECK (char_length("mime_type") <= 255);--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_storage_key_length" CHECK (char_length("storage_key") <= 512);--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_thumbnail_key_length" CHECK ("thumbnail_key" IS NULL OR char_length("thumbnail_key") <= 512);--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_failure_reason_length" CHECK ("failure_reason" IS NULL OR char_length("failure_reason") <= 500);--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_tags_length" CHECK (tags_within_limit("tags"));--> statement-breakpoint
ALTER TABLE "renditions" ADD CONSTRAINT "renditions_label_length" CHECK (char_length("label") <= 32);--> statement-breakpoint
ALTER TABLE "renditions" ADD CONSTRAINT "renditions_storage_key_length" CHECK (char_length("storage_key") <= 512);--> statement-breakpoint
ALTER TABLE "renditions" ADD CONSTRAINT "renditions_mime_type_length" CHECK (char_length("mime_type") <= 255);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_length" CHECK (char_length("email") <= 254);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_password_hash_length" CHECK (char_length("password_hash") <= 255);
