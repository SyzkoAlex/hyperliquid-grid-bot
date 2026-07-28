ALTER TABLE "grids" RENAME COLUMN "levels" TO "order_count";

DROP INDEX IF EXISTS "idx_orders_active_level";
ALTER TABLE "orders" RENAME COLUMN "level_index" TO "order_index";
CREATE UNIQUE INDEX "idx_orders_active_order"
ON "orders" ("grid_id", "order_index", "side")
WHERE "status" IN ('pending', 'placed');
