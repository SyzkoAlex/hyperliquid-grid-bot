CREATE UNIQUE INDEX "idx_orders_active_level"
ON "orders" ("grid_id", "level_index", "side")
WHERE "status" IN ('pending', 'placed');
