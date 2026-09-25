CREATE TABLE "renditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"label" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renditions_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "renditions_asset_label_unique" UNIQUE("asset_id","label")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "renditions" ADD CONSTRAINT "renditions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;