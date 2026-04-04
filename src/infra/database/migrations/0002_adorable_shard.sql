DROP INDEX IF EXISTS "idx_orders_active_level";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fee_usdc" numeric(20, 8);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_orders_active_level" ON "orders" USING btree ("grid_id","level_index","side") WHERE status IN ('pending', 'placed');