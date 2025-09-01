CREATE TABLE IF NOT EXISTS "FAQ" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" varchar(100) NOT NULL,
	"tag" varchar(100) NOT NULL,
	"question" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
