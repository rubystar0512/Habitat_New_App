-- Update commit_status_cache table to match new schema
-- This script updates the table structure to include account_id, status ENUM, and expires_at

-- Drop existing table if it exists (be careful in production!)
-- DROP TABLE IF EXISTS commit_status_cache;

-- Create new table structure
CREATE TABLE IF NOT EXISTS commit_status_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  commit_id INT NOT NULL,
  account_id INT NOT NULL,
  status ENUM(
    'available',
    'reserved',
    'already_reserved',
    'unavailable',
    'too_easy',
    'paid_out',
    'pending_admin_approval',
    'failed',
    'error'
  ) NULL DEFAULT 'available',
  expires_at TIMESTAMP NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_status (commit_id, account_id),
  INDEX idx_commit_id (commit_id),
  INDEX idx_account_id (account_id),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at),
  INDEX idx_checked_at (checked_at),
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES user_habitat_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If table already exists with old structure, migrate it:
-- ALTER TABLE commit_status_cache 
--   ADD COLUMN account_id INT NOT NULL AFTER commit_id,
--   ADD COLUMN status ENUM(...) NULL AFTER account_id,
--   ADD COLUMN expires_at TIMESTAMP NULL AFTER status,
--   CHANGE COLUMN cached_at checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   DROP COLUMN is_available,
--   DROP INDEX unique_commit_id,
--   ADD UNIQUE KEY unique_status (commit_id, account_id),
--   ADD INDEX idx_account_id (account_id),
--   ADD INDEX idx_status (status),
--   ADD INDEX idx_expires_at (expires_at),
--   ADD FOREIGN KEY (account_id) REFERENCES user_habitat_accounts(id) ON DELETE CASCADE;
