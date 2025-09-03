-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."faq_kind" AS ENUM('public', 'internal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "FAQ_Internal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" varchar(100) NOT NULL,
	"tag" varchar(100),
	"question" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "FAQ_Chunks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" "faq_kind" NOT NULL,
	"source_id" uuid NOT NULL,
	"brand" varchar(100),
	"tag" varchar(100),
	"chunk_idx" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- 인덱스 생성
CREATE INDEX IF NOT EXISTS "idx_faq_internal_brand_tag" ON "FAQ_Internal"("brand", "tag");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_faq_chunks_meta" ON "FAQ_Chunks"("kind", "brand", "tag");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_faq_chunks_vec" ON "FAQ_Chunks" USING ivfflat ("embedding" vector_l2_ops) WITH (lists=100);
