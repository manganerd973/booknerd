CREATE INDEX IF NOT EXISTS `chapters_workflow_scheduled_idx`
ON `chapters` (`workflow_status`, `scheduled_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reader_library_book_status_idx`
ON `reader_library` (`book_id`, `status`, `visitor_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reader_notifications_visitor_unread_idx`
ON `reader_notifications` (`visitor_key`, `read_at`, `hidden_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reader_public_notes_rotation_idx`
ON `reader_public_notes` (`status`, `is_spoiler`, `is_pinned`, `approved_at`, `id`);
--> statement-breakpoint
PRAGMA optimize;
