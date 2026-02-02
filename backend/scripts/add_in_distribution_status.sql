-- Add 'in_distribution' to the status ENUM in commit_status_cache table
-- This fixes the error: Data truncated for column 'status' at row 1

ALTER TABLE commit_status_cache 
MODIFY COLUMN status ENUM(
  'available',
  'reserved',
  'already_reserved',
  'unavailable',
  'too_easy',
  'paid_out',
  'pending_admin_approval',
  'failed',
  'error',
  'in_distribution'
) NULL DEFAULT 'available';
