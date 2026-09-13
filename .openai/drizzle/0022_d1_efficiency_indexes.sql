-- These indexes depend on columns that are added idempotently by lib/runtime.js.
-- Creating them there keeps both existing and clean D1 installations safe.
SELECT 1;
--> statement-breakpoint
PRAGMA optimize;
