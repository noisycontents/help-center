CREATE TABLE IF NOT EXISTS "Product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(64) NOT NULL,
	"language" text NOT NULL,
	"category" text,
	"product_name" text NOT NULL,
	"price" integer NOT NULL,
	"discount_price" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Product_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "FAQ_Chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1536);