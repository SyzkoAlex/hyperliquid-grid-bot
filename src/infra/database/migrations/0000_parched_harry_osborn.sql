CREATE TABLE IF NOT EXISTS "grids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(50) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"lower_price" numeric(20, 8) NOT NULL,
	"upper_price" numeric(20, 8) NOT NULL,
	"levels" integer NOT NULL,
	"investment_quote" numeric(20, 8) NOT NULL,
	"investment_base" numeric(20, 8) NOT NULL,
	"trailing_enabled" boolean DEFAULT false NOT NULL,
	"trailing_trigger_percent" numeric(5, 2) DEFAULT '5',
	"trailing_step_percent" numeric(5, 2) DEFAULT '10',
	"trailing_partial_close_percent" numeric(5, 2) DEFAULT '50',
	"trailing_count" integer DEFAULT 0 NOT NULL,
	"last_trailing_at" timestamp,
	"started_at" timestamp,
	"stopped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_order_id" varchar(255),
	"symbol" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"price" numeric(20, 8),
	"amount" numeric(20, 8) NOT NULL,
	"filled_amount" numeric(20, 8) DEFAULT '0',
	"status" varchar(20) NOT NULL,
	"grid_id" uuid NOT NULL,
	"level_index" integer NOT NULL,
	"placed_at" timestamp,
	"filled_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_exchange_order_id_unique" UNIQUE("exchange_order_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_grid_id_grids_id_fk" FOREIGN KEY ("grid_id") REFERENCES "public"."grids"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
