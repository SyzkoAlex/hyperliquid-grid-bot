ALTER TABLE "grids" ADD COLUMN "stop_loss_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "grids" ADD COLUMN "stop_loss_price" numeric(20, 8);
--> statement-breakpoint
ALTER TABLE "grids" ADD COLUMN "stop_loss_triggered_at" timestamp;
