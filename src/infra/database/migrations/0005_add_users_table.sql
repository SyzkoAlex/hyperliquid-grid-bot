CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"account_address" varchar(42) NOT NULL,
	"agent_address" varchar(42) NOT NULL,
	"agent_private_key_encrypted" varchar(500) NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
ALTER TABLE "grids" ADD COLUMN "user_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "grids" ADD CONSTRAINT "grids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
