-- The hidden_at column is added idempotently by lib/runtime.js so this update
-- is safe whether the Worker or migrations reach an existing database first.
SELECT 1;
