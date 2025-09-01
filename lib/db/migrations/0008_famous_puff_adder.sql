ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "wpUserId" varchar(32);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "displayName" varchar(100);